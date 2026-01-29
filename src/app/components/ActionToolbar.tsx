import { useRef } from 'react';

type Props = {
    // State
    dirty: boolean;
    canWrite: boolean;
    busy: boolean;
    hasLocalErrors: boolean;
    // Callbacks
    onValidate: () => void;
    onSave: () => void;
    onCalibrate: () => void;
    onResetMode: () => void;
    onFactoryReset: () => void;
    onReboot: () => void;
    onEnterBootsel: () => void;
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
    onCalibrate,
    onResetMode,
    onFactoryReset,
    onReboot,
    onEnterBootsel,
    onExportProfile,
    onImportProfile,
    onExportDeviceCurrent,
    onExportDeviceDraft,
    onImportDevice,
    rebootAfterSave = false,
    onRebootAfterSaveChange,
}: Props) {
    const importExportMenuRef = useRef<HTMLDetailsElement | null>(null);

    const closeMenu = () => {
        importExportMenuRef.current?.removeAttribute('open');
    };

    return (
        <footer className="layout-footer footer-toolbar">
            {/* Primary actions */}
            <div className="footer-group footer-group-primary">
                <button
                    className="primary"
                    onClick={onSave}
                    disabled={!canWrite || busy || !dirty || hasLocalErrors}
                    title="Save to controller"
                >
                    Save
                </button>
                <button
                    onClick={onValidate}
                    disabled={!canWrite || busy || !dirty}
                >
                    Validate
                </button>
                {dirty && <span className="pill pill-warn" title="You have unsaved changes">Unsaved</span>}
                {!dirty && <span className="pill pill-ok" title="All changes saved">Saved</span>}
                {onRebootAfterSaveChange && (
                    <label className="footer-toggle" title="Automatically reboot after saving">
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

            <div className="footer-divider" />

            {/* Device actions */}
            <div className="footer-group footer-group-actions">
                <button
                    onClick={onCalibrate}
                    disabled={!canWrite || busy}
                    title="Run calibration on the device"
                >
                    Calibrate
                </button>
                <button
                    onClick={onResetMode}
                    disabled={!canWrite || busy}
                    title="Reset current mode settings to defaults"
                >
                    Reset Defaults
                </button>
                <button
                    onClick={onReboot}
                    disabled={busy}
                    title="Reboot the controller"
                >
                    Reboot
                </button>
                <button
                    className="warning"
                    onClick={onEnterBootsel}
                    disabled={busy}
                    title="Reboot into BOOTSEL/UF2 mode for firmware updates (disconnects the configurator)"
                >
                    Firmware Update
                </button>
                <div className="footer-divider footer-divider-sm" />
                <button
                    className="danger"
                    onClick={onFactoryReset}
                    disabled={!canWrite || busy}
                    title="Factory reset the device (both modes)"
                >
                    Factory Reset
                </button>
            </div>

            <div className="footer-divider" />

            {/* Import/Export */}
            <div className="footer-group footer-group-menus">
                <details ref={importExportMenuRef} className="footer-menu">
                    <summary className="footer-menu-trigger">Import/Export</summary>
                    <div className="footer-menu-panel" role="menu" aria-label="Import and export">
                        <div className="footer-menu-label">Profile</div>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenu(); onExportProfile(); }}
                            disabled={busy}
                            title="Export the currently selected profile"
                        >
                            Save Profile
                        </button>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenu(); onImportProfile(); }}
                            disabled={busy}
                            title="Import into the currently selected profile"
                        >
                            Load Profile…
                        </button>

                        <div className="footer-menu-divider" role="separator" />

                        <div className="footer-menu-label">Device</div>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenu(); onExportDeviceCurrent(); }}
                            disabled={busy}
                            title="Export the full device configuration (both modes)"
                        >
                            Save Current
                        </button>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenu(); onExportDeviceDraft(); }}
                            disabled={busy || !dirty}
                            title="Export unsaved changes (both modes)"
                        >
                            Save Draft
                        </button>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenu(); onImportDevice(); }}
                            disabled={busy}
                            title="Import a full device configuration (both modes)"
                        >
                            Load Device…
                        </button>
                    </div>
                </details>
            </div>
        </footer>
    );
}
