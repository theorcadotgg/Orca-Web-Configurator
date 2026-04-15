import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { OrcaErr } from '@shared/orca_config_idl_generated';
import type { SettingsDraft } from '../../schema/settingsBlob';
import { ANALOG_INPUTS, DIGITAL_INPUTS, GP2040_L3_VIRTUAL_DEST, GP2040_R3_VIRTUAL_DEST, IntermediateDigitalOutput, analogInputLabel, digitalInputLabel, ORCA_DUMMY_FIELD } from '../../schema/orcaMappings';
import { getGp2040DestinationLabelSet, type Gp2040LabelPreset } from '../../schema/gp2040Labels';
import type { OrcaInputState, OrcaTransport } from '../../usb/OrcaTransport';
import { OrcaDeviceError } from '../../usb/OrcaTransport';
import { computeInputPreviewWithWasm, initInputPreviewWasm, isWasmReady } from '../../inputPreview/orcaInputPreview';

type Props = {
  transport: OrcaTransport;
  draft: SettingsDraft;
  baseBlob: Uint8Array;
  configMode: 'orca' | 'gp2040';
  gp2040LabelPreset?: Gp2040LabelPreset;
  disabled?: boolean;
  style?: CSSProperties;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function format(v: number): string {
  if (!Number.isFinite(v)) return '—';
  // Round to nearest 0.0125 (1/80 pixel precision)
  const rounded = Math.round(v / 0.0125) * 0.0125;
  return rounded.toFixed(4);
}

function StickGate(props: { x: number; y: number; notchStart: number; notchEnd: number }) {
  const size = 180;
  const pad = 14;
  const c = size / 2;
  const r = c - pad;

  const x = props.x;
  const y = props.y;
  const xClamped = clamp(x, -1, 1);
  const yClamped = clamp(y, -1, 1);
  const px = c + xClamped * r;
  const py = c - yClamped * r;

  const overflow = Math.abs(x) > 1 || Math.abs(y) > 1;

  const notchStart = clamp(props.notchStart, 0, 1) * r;
  const notchEnd = clamp(props.notchEnd, 0, 1) * r;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: 'block',
        background: 'radial-gradient(circle at center, rgba(255,255,255,0.04), rgba(255,255,255,0.00) 70%)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Gate */}
      <circle cx={c} cy={c} r={r} fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />

      {/* Notch band (input-domain hint) */}
      <circle cx={c} cy={c} r={notchStart} fill="none" stroke="rgba(30,143,201,0.35)" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={c} cy={c} r={notchEnd} fill="none" stroke="rgba(30,143,201,0.20)" strokeWidth="1" strokeDasharray="2 6" />

      {/* Crosshair */}
      <line x1={c} y1={pad} x2={c} y2={size - pad} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <line x1={pad} y1={c} x2={size - pad} y2={c} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

      {/* Dot */}
      <circle cx={px} cy={py} r={7} fill={overflow ? 'var(--color-warning)' : 'var(--color-brand)'} stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
    </svg>
  );
}

function AnalogBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = clamp(value / max, 0, 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 70px', gap: 10, alignItems: 'center' }}>
      <span className="text-sm text-secondary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: 'var(--color-brand)' }} />
      </div>
      <span className="text-xs" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{format(value)}</span>
    </div>
  );
}

function gp2040PreviewLabel(output: IntermediateDigitalOutput, preset: Gp2040LabelPreset | undefined): string {
  const digital = getGp2040DestinationLabelSet(preset).digital;
  switch (output) {
    case IntermediateDigitalOutput.A: return digital[0]?.label ?? 'A';
    case IntermediateDigitalOutput.B: return digital[1]?.label ?? 'B';
    case IntermediateDigitalOutput.X: return digital[2]?.label ?? 'X';
    case IntermediateDigitalOutput.Y: return digital[3]?.label ?? 'Y';
    case IntermediateDigitalOutput.Z: return 'Z';
    case IntermediateDigitalOutput.L1: return digital[12]?.label ?? 'L1';
    case IntermediateDigitalOutput.L2: return digital[5]?.label ?? 'L2';
    case IntermediateDigitalOutput.L3: return digital[GP2040_L3_VIRTUAL_DEST]?.label ?? 'L3';
    case IntermediateDigitalOutput.R1: return digital[4]?.label ?? 'R1';
    case IntermediateDigitalOutput.R2: return digital[6]?.label ?? 'R2';
    case IntermediateDigitalOutput.R3: return digital[GP2040_R3_VIRTUAL_DEST]?.label ?? 'R3';
    case IntermediateDigitalOutput.START: return digital[15]?.label ?? 'Start';
    case IntermediateDigitalOutput.SELECT: return digital[13]?.label ?? 'Select';
    case IntermediateDigitalOutput.HOME: return digital[11]?.label ?? 'Home';
    case IntermediateDigitalOutput.DPAD_UP: return 'DPAD Up';
    case IntermediateDigitalOutput.DPAD_DOWN: return 'DPAD Down';
    case IntermediateDigitalOutput.DPAD_LEFT: return 'DPAD Left';
    case IntermediateDigitalOutput.DPAD_RIGHT: return 'DPAD Right';
    default: return `Out ${output}`;
  }
}

export function LiveInputPreviewCard({ transport, draft, baseBlob, configMode, gp2040LabelPreset, disabled, style }: Props) {
  const [raw, setRaw] = useState<OrcaInputState | null>(null);
  const [supported, setSupported] = useState(true);
  const [lastErr, setLastErr] = useState<string>('');

  // Initialize WASM on mount
  useEffect(() => {
    void initInputPreviewWasm();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSupported(true);
    setLastErr('');

    async function run() {
      while (!cancelled) {
        if (disabled) {
          await sleep(100);
          continue;
        }
        try {
          const next = await transport.getInputState();
          if (cancelled) return;
          setRaw(next);
          setLastErr('');
          await sleep(16); // ~60Hz
        } catch (e) {
          if (cancelled) return;
          if (e instanceof OrcaDeviceError && e.err === OrcaErr.UNSUPPORTED_CMD) {
            setSupported(false);
            return;
          }
          setLastErr(e instanceof Error ? e.message : String(e));
          await sleep(250);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [disabled, transport]);

  const computed = useMemo(() => {
    if (!raw) return null;
    return computeInputPreviewWithWasm(raw, draft, baseBlob, configMode);
  }, [baseBlob, configMode, draft, raw]);

  const notchStart = draft.stickCurveParams[draft.activeProfile]?.notch_start_input ?? draft.stickCurveParams[0]?.notch_start_input ?? 0;
  const notchEnd = draft.stickCurveParams[draft.activeProfile]?.notch_end_input ?? draft.stickCurveParams[0]?.notch_end_input ?? 0;

  const analogMax = useMemo(() => {
    const profile = draft.activeProfile ?? 0;
    const p = draft.stickCurveParams[profile] ?? draft.stickCurveParams[0];
    const range = p?.range ?? [];
    // Prefer the configured stick ranges; fall back to 1.0.
    return Math.max(1, ...range.slice(0, 4).filter((v) => Number.isFinite(v) && v > 0));
  }, [draft]);

  const pressedOutputs = useMemo(() => {
    if (!computed) return [];
    if (configMode === 'gp2040' && computed.wasmOutput) {
      const labels: string[] = [];
      for (let output = 0; output <= IntermediateDigitalOutput.DPAD_RIGHT; output++) {
        if (((computed.wasmOutput.digitalMask >>> output) & 1) !== 0) {
          labels.push(gp2040PreviewLabel(output as IntermediateDigitalOutput, gp2040LabelPreset));
        }
      }
      return labels;
    }
    const labels: string[] = [];
    for (const d of DIGITAL_INPUTS) {
      if (d.id === ORCA_DUMMY_FIELD) continue;
      if (((computed.mappedDigitalMask >>> d.id) & 1) !== 0) labels.push(digitalInputLabel(d.id));
    }
    return labels;
  }, [computed, configMode, gp2040LabelPreset]);

  if (!supported) {
    return (
      <div className="card animate-slide-up" style={{ marginTop: 'var(--spacing-lg)' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Live Input Preview</h2>
            <p className="card-subtitle">Requires newer config-mode firmware</p>
          </div>
        </div>
        <div className="text-sm text-muted">
          This firmware does not support live input preview (unsupported command).
        </div>
      </div>
    );
  }

  return (
    <div className="card animate-slide-up" style={{ marginTop: 'var(--spacing-lg)', ...(style ?? {}) }}>
      <div className="card-header">
        <div>
          <h2 className="card-title">Live Input Preview</h2>
          <p className="card-subtitle">Mapped outputs (draft config)</p>
        </div>
        {lastErr && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="pill pill-warn" title={lastErr}>Warning</span>
          </div>
        )}
      </div>

      {!raw ? (
        <div className="text-sm text-muted">Waiting for input…</div>
      ) : !isWasmReady() || !computed || !computed.meleeOutput ? (
        <div className="text-sm text-muted">Initializing processor…</div>
      ) : (() => {
        // WASM provides Melee coordinates directly (like SmashScope, can exceed ±80)
        const meleeX = computed.meleeOutput.leftStick.x;
        const meleeY = computed.meleeOutput.leftStick.y;
        const meleeMag = Math.sqrt(meleeX * meleeX + meleeY * meleeY);

        // Apply 80-unit circle projection like the Melee calculator does
        // clamp = 80 / magnitude, then project and divide by 80
        const clampFactor = meleeMag > 0 ? Math.min(1, 80 / meleeMag) : 1;
        const projectedX = Math.trunc(meleeX * clampFactor);
        const projectedY = Math.trunc(meleeY * clampFactor);
        const normalizedX = projectedX / 80;
        const normalizedY = projectedY / 80;

        // Gate display: clamp to unit circle
        const stickCoordsNormalized = { x: normalizedX, y: normalizedY };

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--spacing-lg)', alignItems: 'start' }}>
            <div className="col" style={{ gap: 'var(--spacing-sm)' }}>
              <StickGate x={stickCoordsNormalized.x} y={stickCoordsNormalized.y} notchStart={notchStart} notchEnd={notchEnd} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="text-xs text-secondary">X: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{format(normalizedX)}</span></div>
                <div className="text-xs text-secondary">Y: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{format(normalizedY)}</span></div>
                <div className="text-xs text-secondary">Mag: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{meleeMag.toFixed(1)}</span></div>
                <div className="text-xs text-secondary">TR: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(computed.triggers.r * 255)}</span></div>
              </div>
            </div>

            <div className="col" style={{ gap: 'var(--spacing-md)' }}>
              <div className="col" style={{ gap: 8 }}>
                <div className="text-sm" style={{ fontWeight: 600 }}>Analog</div>
                {ANALOG_INPUTS.map((a) => (
                  <AnalogBar
                    key={a.id}
                    label={analogInputLabel(a.id)}
                    value={computed.mappedAnalog[a.id] ?? 0}
                    max={a.id === 4 ? 1 : analogMax}
                  />
                ))}
              </div>

              <div className="col" style={{ gap: 8 }}>
                <div className="text-sm" style={{ fontWeight: 600 }}>Digital</div>
                {pressedOutputs.length === 0 ? (
                  <div className="text-sm text-muted">No outputs active</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pressedOutputs.map((label) => (
                      <span key={label} className="pill pill-brand">{label}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
