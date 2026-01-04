type Props = {
  isOpen: boolean;
};

export function CalibrationRunningModal({ isOpen }: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
          Calibration Mode
        </h3>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <p style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>
            Move sticks and triggers through their full range.
          </p>
          <p style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>
            Press <strong>3</strong> to finish and return to the configurator.
          </p>
          <p style={{ margin: 0 }}>
            Keep this tab open until calibration completes.
          </p>
        </div>
        <div className="row" style={{ marginTop: 'var(--spacing-lg)', justifyContent: 'flex-end' }}>
          <span className="pill pill-brand">Waiting for 3</span>
        </div>
      </div>
    </div>
  );
}

