type Props = {
  errors: string[];
  warnings: string[];
  deviceErrors?: string[] | null;
  deviceRepaired?: boolean | null;
};

export function ValidationCard({ errors, warnings, deviceErrors, deviceRepaired }: Props) {
  const hasDevice = deviceErrors != null || deviceRepaired != null;
  const hasIssues = errors.length > 0 || warnings.length > 0 || (deviceErrors && deviceErrors.length > 0);

  return (
    <div className="card animate-slide-up">
      <div className="card-header">
        <h2 className="card-title">Validation</h2>
        {!hasIssues && <span className="pill pill-ok">All checks passed</span>}
      </div>

      {errors.length > 0 && (
        <div className="message message-error" style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
            ⚠ Blocking Errors
          </div>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)' }}>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="message" style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          marginBottom: 'var(--spacing-md)'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)', color: 'var(--color-accent-warning)' }}>
            ⚡ Warnings
          </div>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {hasDevice && (
        <div className="message message-info">
          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
            📡 Device Validation
          </div>
          {deviceRepaired && (
            <p style={{ margin: '0 0 8px', opacity: 0.9 }}>
              ✓ Firmware repaired fields during validation.
            </p>
          )}
          {deviceErrors && deviceErrors.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)' }}>
              {deviceErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : deviceErrors ? (
            <p style={{ margin: 0, opacity: 0.8 }}>
              ✓ No device-reported structural issues.
            </p>
          ) : null}
        </div>
      )}

      {!hasIssues && !hasDevice && (
        <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
          No validation errors or warnings.
        </p>
      )}
    </div>
  );
}
