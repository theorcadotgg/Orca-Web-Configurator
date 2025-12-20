import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { OrcaErr } from '@shared/orca_config_idl_generated';
import type { SettingsDraft } from '../../schema/settingsBlob';
import { ANALOG_INPUTS, DIGITAL_INPUTS, analogInputLabel, digitalInputLabel, ORCA_DUMMY_FIELD } from '../../schema/orcaMappings';
import type { OrcaInputState, OrcaTransport } from '../../usb/OrcaTransport';
import { OrcaDeviceError } from '../../usb/OrcaTransport';
import { computeInputPreview } from '../../inputPreview/orcaInputPreview';

type Props = {
  transport: OrcaTransport;
  draft: SettingsDraft;
  baseBlob: Uint8Array;
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

/**
 * Scale stick coordinates to Melee-style 80-pixel unit circle.
 * The input x/y come from firmware in 128-unit space (range 0..1 maps to 0..128).
 * Melee uses 80-unit space with integer truncation for clamping.
 * Formula from orcagui.html: clamp = 80 / sqrt(x² + y²), then Math.trunc(coord * clamp) / 80.
 */
function scaleToMeleeUnitCircle(x: number, y: number): { x: number; y: number } {
  const MELEE_RADIUS = 80;

  // Convert from firmware 128-unit space to Melee integer format
  // Multiply by 128 to get the raw integer value the firmware uses
  const xInt = Math.round(x * 128);
  const yInt = Math.round(y * 128);

  const magnitude = Math.sqrt(xInt * xInt + yInt * yInt);

  if (magnitude <= MELEE_RADIUS) {
    // Within the unit circle, just divide by 80 for normalized output
    // Use Math.trunc to match Melee's integer quantization
    return {
      x: Math.trunc(xInt) / MELEE_RADIUS,
      y: Math.trunc(yInt) / MELEE_RADIUS,
    };
  }

  // Outside the circle: project onto the edge using Melee's exact formula
  // clamp = 80 / magnitude, then Math.trunc(coord * clamp) / 80
  const clampFactor = MELEE_RADIUS / magnitude;
  return {
    x: Math.trunc(xInt * clampFactor) / MELEE_RADIUS,
    y: Math.trunc(yInt * clampFactor) / MELEE_RADIUS,
  };
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

export function LiveInputPreviewCard({ transport, draft, baseBlob, disabled, style }: Props) {
  const [raw, setRaw] = useState<OrcaInputState | null>(null);
  const [supported, setSupported] = useState(true);
  const [lastErr, setLastErr] = useState<string>('');

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
    return computeInputPreview(raw, draft, baseBlob);
  }, [baseBlob, draft, raw]);

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
    const labels: string[] = [];
    for (const d of DIGITAL_INPUTS) {
      if (d.id === ORCA_DUMMY_FIELD) continue;
      if (((computed.mappedDigitalMask >>> d.id) & 1) !== 0) labels.push(digitalInputLabel(d.id));
    }
    return labels;
  }, [computed]);

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
        {lastErr && <span className="pill pill-warn" title={lastErr}>Warning</span>}
      </div>

      {!computed ? (
        <div className="text-sm text-muted">Waiting for input…</div>
      ) : (() => {
        // Apply Melee-style unit circle scaling for Orca mode
        // Function expects firmware 0-1 range values and converts to Melee 80-unit space internally
        const stickCoords = scaleToMeleeUnitCircle(computed.joystick.x, computed.joystick.y);

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--spacing-lg)', alignItems: 'start' }}>
            <div className="col" style={{ gap: 'var(--spacing-sm)' }}>
              <StickGate x={stickCoords.x} y={stickCoords.y} notchStart={notchStart} notchEnd={notchEnd} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="text-xs text-secondary">X: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{format(stickCoords.x)}</span></div>
                <div className="text-xs text-secondary">Y: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{format(stickCoords.y)}</span></div>
                <div className="text-xs text-secondary">Mag: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{format(Math.sqrt(stickCoords.x * stickCoords.x + stickCoords.y * stickCoords.y))}</span></div>
                <div className="text-xs text-secondary">TR: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{format(computed.triggers.r)}</span></div>
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
