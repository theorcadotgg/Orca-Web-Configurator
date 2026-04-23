import { useEffect } from 'react';
import { ButtonChordGlyph } from './ButtonChordGlyph';
import { getGp2040InputModeLabel } from '../../schema/gp2040InputModes';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const RUNTIME_PROFILE_SELECTORS = [
  { selector: 'R2', profile: 'Profile 1' },
  { selector: 'B4', profile: 'Profile 2' },
  { selector: 'L1', profile: 'Profile 3' },
  { selector: 'B2', profile: 'Profile 4' },
  { selector: 'B3', profile: 'Profile 5' },
  { selector: 'R1', profile: 'Profile 6' },
] as const;

const BOOT_MODE_SELECTORS = [
  { selector: 'B1', mode: getGp2040InputModeLabel(1) },
  { selector: 'B2', mode: getGp2040InputModeLabel(0) },
  { selector: 'B3', mode: getGp2040InputModeLabel(2) },
  { selector: 'B4', mode: getGp2040InputModeLabel(4) },
] as const;

export function Gp2040HelpModal({ isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="GP2040 instructions">
      <div className="modal-content gp2040-help-modal" onClick={(event) => event.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--spacing-md)' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>GP2040 Instructions</h3>
            <div className="text-xs text-muted">Boot, profile, and mode shortcuts</div>
          </div>
          <button className="ghost sm" onClick={onClose} aria-label="Close GP2040 instructions">
            ✕
          </button>
        </div>

        <div className="gp2040-help-body" style={{ marginTop: 'var(--spacing-md)' }}>
          <section className="gp2040-help-section">
            <h4 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>1. Enter GP2040 Mode</h4>
            <p style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>
              Hold while connecting USB.
            </p>
            <div className="gp2040-chord-legend">
              <ButtonChordGlyph
                size={74}
                filled={['top', 'right']}
                ariaLabel="S2 and A1 chord"
              />
            </div>
          </section>

          <section className="gp2040-help-section">
            <h4 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>2. Switch GP2040 Profiles</h4>
            <p style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>
              Startup always begins on the default profile (Profile 1).
            </p>
            <p style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>
              Runtime shortcut: hold while connected, then tap one selector:
            </p>
            <div className="gp2040-chord-legend" style={{ marginBottom: 'var(--spacing-sm)' }}>
              <ButtonChordGlyph
                size={74}
                filled={['top', 'left']}
                ariaLabel="S2 and S1 chord"
              />
            </div>
            <table className="gp2040-help-table">
              <thead>
                <tr>
                  <th>Selector</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {RUNTIME_PROFILE_SELECTORS.map((row) => (
                  <tr key={row.selector}>
                    <td><code>{row.selector}</code></td>
                    <td>{row.profile}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="gp2040-help-section">
            <h4 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>3. Select GP2040 Input Mode on Boot</h4>
            <p style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>
              Keep holding at plug-in while also holding one mode button:
            </p>
            <p style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>
              These startup shortcuts still work even if you change the saved default in the configurator.
            </p>
            <div className="gp2040-chord-legend" style={{ marginBottom: 'var(--spacing-sm)' }}>
              <ButtonChordGlyph
                size={74}
                filled={['top', 'right']}
                ariaLabel="S2 and A1 chord"
              />
            </div>
            <table className="gp2040-help-table">
              <thead>
                <tr>
                  <th>Mode Button</th>
                  <th>Input Mode</th>
                </tr>
              </thead>
              <tbody>
                {BOOT_MODE_SELECTORS.map((row) => (
                  <tr key={row.selector}>
                    <td><code>{row.selector}</code></td>
                    <td>{row.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-muted" style={{ marginTop: 'var(--spacing-sm)' }}>
              The configurator updates the same saved GP2040 input mode. Boot-chord changes and configurator changes stay in sync.
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 'var(--spacing-xs)' }}>
              Orca does not expose GP2040 Keyboard mode because keyboard key mappings are not configurable here.
            </div>
          </section>
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
