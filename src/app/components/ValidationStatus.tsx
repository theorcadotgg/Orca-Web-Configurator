type Props = {
    errors: string[];
    warnings: string[];
    deviceErrors?: string[] | null;
    deviceRepaired?: boolean | null;
};

export function ValidationStatus({ errors, warnings, deviceErrors, deviceRepaired }: Props) {
    const hasDevice = deviceErrors != null || deviceRepaired != null;
    const hasIssues = errors.length > 0 || warnings.length > 0 || (deviceErrors && deviceErrors.length > 0);

    if (!hasIssues && !hasDevice) {
        return (
            <div className="text-sm text-secondary">
                ✓ No validation issues
            </div>
        );
    }

    return (
        <div className="col">
            {errors.length > 0 && (
                <div className="message message-error">
                    <strong>Errors ({errors.length})</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12 }}>
                        {errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                        {errors.length > 3 && <li>+{errors.length - 3} more...</li>}
                    </ul>
                </div>
            )}

            {warnings.length > 0 && (
                <div className="message message-warning">
                    <strong>Warnings ({warnings.length})</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12 }}>
                        {warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                        {warnings.length > 3 && <li>+{warnings.length - 3} more...</li>}
                    </ul>
                </div>
            )}

            {hasDevice && (
                <div className="message message-info">
                    {deviceRepaired && <div className="text-xs">✓ Firmware repaired fields</div>}
                    {deviceErrors && deviceErrors.length > 0 ? (
                        <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12 }}>
                            {deviceErrors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    ) : deviceErrors ? (
                        <div className="text-xs">✓ No device issues</div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
