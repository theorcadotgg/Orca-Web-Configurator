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
    const actionsMenuRef = useRef<HTMLDetailsElement | null>(null);
    const filesMenuRef = useRef<HTMLDetailsElement | null>(null);

    const closeMenus = () => {
        actionsMenuRef.current?.removeAttribute('open');
        filesMenuRef.current?.removeAttribute('open');
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

            {/* Menus */}
            <div className="footer-group footer-group-menus">
                <details ref={actionsMenuRef} className="footer-menu">
                    <summary className="footer-menu-trigger">Actions</summary>
                    <div className="footer-menu-panel" role="menu" aria-label="Device actions">
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenus(); onCalibrate(); }}
                            disabled={!canWrite || busy}
                            title="Run calibration on the device"
                        >
                            Calibrate
                        </button>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenus(); onResetMode(); }}
                            disabled={!canWrite || busy}
                            title="Reset current mode settings to defaults"
                        >
                            Reset Mode Defaults
                        </button>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenus(); onReboot(); }}
                            disabled={busy}
                            title="Reboot the controller"
                        >
                            Reboot
                        </button>
                        <button
                            className="footer-menu-item warning"
                            onClick={() => { closeMenus(); onEnterBootsel(); }}
                            disabled={busy}
                            title="Reboot into BOOTSEL/UF2 mode for firmware updates (disconnects the configurator)"
                        >
                            Firmware Update (BOOTSEL)
                        </button>

                        <div className="footer-menu-divider" role="separator" />

                        <button
                            className="footer-menu-item danger"
                            onClick={() => { closeMenus(); onFactoryReset(); }}
                            disabled={!canWrite || busy}
                            title="Factory reset the device (both modes)"
                        >
                            Factory Reset Device
                        </button>
                    </div>
                </details>

                <details ref={filesMenuRef} className="footer-menu">
                    <summary className="footer-menu-trigger">Import/Export</summary>
                    <div className="footer-menu-panel" role="menu" aria-label="Import and export">
                        <div className="footer-menu-label">Profile</div>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenus(); onExportProfile(); }}
                            disabled={busy}
                            title="Export the currently selected profile"
                        >
                            Save Profile
                        </button>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenus(); onImportProfile(); }}
                            disabled={busy}
                            title="Import into the currently selected profile"
                        >
                            Load Profile…
                        </button>

                        <div className="footer-menu-divider" role="separator" />

                        <div className="footer-menu-label">Device</div>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenus(); onExportDeviceCurrent(); }}
                            disabled={busy}
                            title="Export the full device configuration (both modes)"
                        >
                            Save Current
                        </button>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenus(); onExportDeviceDraft(); }}
                            disabled={busy || !dirty}
                            title="Export unsaved changes (both modes)"
                        >
                            Save Draft
                        </button>
                        <button
                            className="footer-menu-item"
                            onClick={() => { closeMenus(); onImportDevice(); }}
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
