import type { ReactNode } from 'react';

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
    onExportCurrent: () => void;
    onExportDraft: () => void;
    onImport: () => void;
    // Optional
    rebootAfterSave?: boolean;
    onRebootAfterSaveChange?: (value: boolean) => void;
    importInputRef?: React.RefObject<HTMLInputElement | null>;
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
    onExportCurrent,
    onExportDraft,
    onImport,
    rebootAfterSave = true,
    onRebootAfterSaveChange,
    importInputRef,
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
                    Reset Defaults
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
                <button onClick={onExportCurrent} disabled={busy}>
                    Export
                </button>
                <button onClick={onExportDraft} disabled={busy || !dirty}>
                    Export Draft
                </button>
                <button onClick={onImport} disabled={busy}>
                    Import…
                </button>
            </div>
        </footer>
    );
}
