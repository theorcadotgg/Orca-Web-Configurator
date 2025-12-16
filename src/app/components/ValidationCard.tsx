type Props = {
  errors: string[];
  warnings: string[];
  deviceErrors?: string[] | null;
  deviceRepaired?: boolean | null;
};

export function ValidationCard({ errors, warnings, deviceErrors, deviceRepaired }: Props) {
  const hasDevice = deviceErrors != null || deviceRepaired != null;

  return (
    <div className="card">
      <div className="row">
        <strong>Validation</strong>
      </div>

      {errors.length ? (
        <div style={{ marginTop: 10 }}>
          <div className="pill pill-bad">Blocking errors</div>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={{ marginTop: 10 }} className="pill pill-ok">
          No blocking errors
        </div>
      )}

      {warnings.length ? (
        <div style={{ marginTop: 10 }}>
          <div className="pill pill-warn">Warnings</div>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasDevice ? (
        <div style={{ marginTop: 12 }}>
          <div className="pill pill-neutral">Device validation</div>
          {deviceRepaired ? <div style={{ marginTop: 6 }}>Firmware repaired fields during validation.</div> : null}
          {deviceErrors && deviceErrors.length ? (
            <ul>
              {deviceErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : deviceErrors ? (
            <div style={{ marginTop: 6 }}>No device-reported structural issues.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

