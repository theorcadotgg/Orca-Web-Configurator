type Props = {
    // State
    dirty: boolean;
    canWrite: boolean;
    busy: boolean;
    hasLocalErrors: boolean;
    // Callbacks
    onValidate: () => void;
    onSave: () => void;
    onReset: () => void;
    onReboot: () => void;
    onExportProfile: () => void;
    onImportProfile: () => void;
    onExportDeviceCurrent: () => void;
    onExportDeviceDraft: () => void;
    onImportDevice: () => void;
    // Optional
    rebootAfterSave?: boolean;
    onRebootAfterSaveChange?: (value: boolean) => void;
};

export function ActionToolbar({
    dirty,
    canWrite,
    busy,
    hasLocalErrors,
    onValidate,
    onSave,
    onReset,
    onReboot,
    onExportProfile,
    onImportProfile,
    onExportDeviceCurrent,
    onExportDeviceDraft,
    onImportDevice,
    rebootAfterSave = false,
    onRebootAfterSaveChange,
}: Props) {
    return (
        <footer className="layout-footer">
            {/* Primary actions */}
            <div className="footer-group">
                <button
                    className="primary"
                    onClick={onSave}
                    disabled={!canWrite || busy || !dirty || hasLocalErrors}
                >
                    Save to Controller
                </button>
                <button
                    onClick={onValidate}
                    disabled={!canWrite || busy || !dirty}
                >
                    Validate
                </button>
                {dirty && <span className="pill pill-warn">Unsaved</span>}
                {!dirty && <span className="pill pill-ok">Saved</span>}
            </div>

            {/* Divider */}
            <div className="footer-divider" />

            {/* Secondary actions */}
            <div className="footer-group">
                <button className="danger" onClick={onReset} disabled={!canWrite || busy}>
                    Factory Reset
                </button>
                <button onClick={onReboot} disabled={busy}>
                    Reboot
                </button>
                {onRebootAfterSaveChange && (
                    <label className="text-sm">
                        <input
                            type="checkbox"
                            checked={rebootAfterSave}
                            onChange={(e) => onRebootAfterSaveChange(e.target.checked)}
                            disabled={busy}
                        />
                        Auto-reboot
                    </label>
                )}
            </div>

            {/* Divider */}
            <div className="footer-divider" />

            {/* Import/Export */}
            <div className="footer-group">
                <span className="text-xs text-muted">Profile</span>
                <button onClick={onExportProfile} disabled={busy} title="Export the currently selected profile">
                    Export
                </button>
                <button onClick={onImportProfile} disabled={busy} title="Import into the currently selected profile">
                    Import…
                </button>

                <div className="footer-divider" style={{ height: 16 }} />

                <span className="text-xs text-muted">Device</span>
                <button onClick={onExportDeviceCurrent} disabled={busy} title="Export the full device configuration for this mode">
                    Export
                </button>
                <button onClick={onExportDeviceDraft} disabled={busy || !dirty} title="Export unsaved changes for this mode">
                    Export Draft
                </button>
                <button onClick={onImportDevice} disabled={busy} title="Import a full device configuration for this mode">
                    Import…
                </button>
            </div>
        </footer>
    );
}
