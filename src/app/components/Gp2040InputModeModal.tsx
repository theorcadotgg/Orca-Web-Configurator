import { useEffect } from 'react';
import type { Gp2040InputModeState } from '../domain/gp2040InputModeState';
import {
  DEFAULT_GP2040_INPUT_MODE,
  getGp2040InputModeLabel,
  GP2040_INPUT_MODE_GROUPS,
  isGp2040SelectableInputMode,
} from '../../schema/gp2040InputModes';

type Props = {
  isOpen: boolean;
  inputModeState: Gp2040InputModeState;
  disabled?: boolean;
  onDraftChange: (next: number) => void;
  onApply: () => void;
  onClose: () => void;
};

export function Gp2040InputModeModal({
  isOpen,
  inputModeState,
  disabled = false,
  onDraftChange,
  onApply,
  onClose,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentLabel = inputModeState.current === null ? 'Loading...' : getGp2040InputModeLabel(inputModeState.current);
  const draftValue = inputModeState.draft ?? DEFAULT_GP2040_INPUT_MODE;
  const draftIsSelectable = inputModeState.draft !== null && isGp2040SelectableInputMode(inputModeState.draft);
  const canApply =
    !disabled &&
    !inputModeState.busy &&
    inputModeState.draft !== null &&
    (inputModeState.dirty || inputModeState.usingDefaults);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="GP2040 input mode">
      <div className="modal-content gp2040-input-mode-modal" onClick={(event) => event.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--spacing-md)' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>GP2040 Input Mode</h3>
            <div className="text-xs text-muted">Saved device default, independent of profile and secondary-slot mappings</div>
          </div>
          <button className="ghost sm" onClick={onClose} aria-label="Close GP2040 input mode">
            ✕
          </button>
        </div>

        <div className="gp2040-input-mode-body" style={{ marginTop: 'var(--spacing-md)' }}>
          <div className="gp2040-input-mode-panel">
            <div className="row gp2040-input-mode-summary">
              <div className="col" style={{ gap: 'var(--spacing-xs)' }}>
                <span className="text-xs text-muted">Current saved mode</span>
                <span className="gp2040-input-mode-current">{currentLabel}</span>
              </div>
              <div className="text-sm text-secondary gp2040-input-mode-note">
                This is the saved GP2040 startup default for the device, not a per-profile setting.
              </div>
            </div>

            {inputModeState.usingDefaults && (
              <div className="message message-info">
                No valid GP2040 FlashPROM config was found. The device is currently using the Orca default fallback until you apply a saved mode.
              </div>
            )}

            {inputModeState.error && (
              <div className="message message-warning">{inputModeState.error}</div>
            )}

            {!draftIsSelectable && inputModeState.draft !== null && (
              <div className="message message-warning">
                {getGp2040InputModeLabel(inputModeState.draft)} is not configurable in Orca because keyboard key mappings are not supported here. Select another mode to switch away from it.
              </div>
            )}

            <div className="row gp2040-input-mode-controls">
              <div className="col gp2040-input-mode-select">
                <span className="text-sm text-secondary">Saved mode</span>
                <span className="text-xs text-muted gp2040-input-mode-select-hint">
                  Common modes are listed first. Specialized modes may require passthrough or authentication hardware.
                </span>
                <select
                  value={draftValue}
                  onChange={(event) => onDraftChange(Number(event.target.value))}
                  disabled={disabled || inputModeState.busy || inputModeState.draft === null}
                >
                  {!draftIsSelectable && inputModeState.draft !== null && (
                    <option value={inputModeState.draft}>
                      {getGp2040InputModeLabel(inputModeState.draft)} (unsupported in Orca)
                    </option>
                  )}
                  {GP2040_INPUT_MODE_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <button className="primary" onClick={() => void onApply()} disabled={!canApply}>
                {inputModeState.busy ? 'Applying...' : 'Apply'}
              </button>
            </div>

            <div className="text-xs text-muted">
              Boot chords still work. Changes here and changes made at boot update the same persisted GP2040 setting.
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
