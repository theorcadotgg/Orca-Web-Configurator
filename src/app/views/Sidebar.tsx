import { useOrcaApp } from '../contexts/OrcaAppContext';
import { CollapsiblePanel } from '../components/CollapsiblePanel';
import { DpadEditor } from '../components/DpadEditor';
import { StickCurveEditor } from '../components/StickCurveEditor';
import { TriggerEditor } from '../components/TriggerEditor';
import { ValidationStatus } from '../components/ValidationStatus';

export function Sidebar() {
  const {
    state,
    gp2040LabelPreset,
    activeSlot,
    draft,
    compatibility,
    localValidation,
    activeProfile,
    deviceErrors,
    deviceRepaired,
    disconnect,
    onDraftChange,
    setAllowUnsafeWrites,
  } = useOrcaApp();

  return (
    <aside className="layout-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-header">
          <span className="sidebar-title">Connection</span>
          {state.transport && <span className="pill pill-ok">Connected</span>}
        </div>
        {state.transport ? (
          <div className="col">
            <div className="form-row">
              <span className="form-label">Device</span>
              <span className="text-sm">Orca</span>
            </div>
            <div className="form-row">
              <span className="form-label">Schema</span>
              <span className="text-sm">
                v{state.deviceInfo?.settingsMajor ?? '?'}.{state.deviceInfo?.settingsMinor ?? '?'}
              </span>
            </div>
            <button className="danger" onClick={() => void disconnect()} disabled={state.busy} style={{ marginTop: 'var(--spacing-sm)' }}>
              Disconnect
            </button>
          </div>
        ) : (
          <div className="text-sm text-muted">Not connected</div>
        )}
      </div>

      <CollapsiblePanel title="Stick Configuration">
        {draft ? (
          <StickCurveEditor draft={draft} disabled={state.busy} onChange={onDraftChange} mode={state.configMode} />
        ) : (
          <div className="text-sm text-muted">Connect to configure</div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Trigger Configuration">
        {draft ? (
              <>
                {activeSlot === 1 && (
                  <div className="text-xs text-muted" style={{ marginBottom: 'var(--spacing-sm)' }}>
                Stored per mode and profile. GP2040 analog trigger routing and light-trigger bindings are configured in the main mapping.
                  </div>
                )}
                <TriggerEditor draft={draft} disabled={state.busy} onChange={onDraftChange} mode={state.configMode} />
              </>
        ) : (
          <div className="text-sm text-muted">Connect to configure</div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title="DPAD Layer"
        badge={
          (() => {
            const layer = draft?.dpadLayer?.[activeProfile];
            if (!layer) return null;
            const active = layer.mode_up !== 0 || layer.mode_down !== 0 || layer.mode_left !== 0 || layer.mode_right !== 0;
            return active ? (
              <span className="pill pill-brand" style={{ marginLeft: 8 }}>
                Active
              </span>
            ) : null;
          })()
        }
      >
        {draft ? (
          <DpadEditor
            draft={draft}
            disabled={state.busy}
            onChange={onDraftChange}
            contextMode={state.configMode}
            gp2040LabelPreset={gp2040LabelPreset}
          />
        ) : (
          <div className="text-sm text-muted">Connect to configure</div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Validation"
        badge={
          localValidation.errors.length > 0 ? (
            <span className="pill pill-error" style={{ marginLeft: 8 }}>
              {localValidation.errors.length}
            </span>
          ) : localValidation.warnings.length > 0 ? (
            <span className="pill pill-warn" style={{ marginLeft: 8 }}>
              {localValidation.warnings.length}
            </span>
          ) : null
        }
      >
        <ValidationStatus
          errors={localValidation.errors}
          warnings={localValidation.warnings}
          deviceErrors={deviceErrors}
          deviceRepaired={deviceRepaired}
        />
      </CollapsiblePanel>
    </aside>
  );
}
