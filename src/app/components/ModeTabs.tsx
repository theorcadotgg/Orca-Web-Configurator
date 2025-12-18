type Mode = 'orca' | 'gp2040';

type Props = {
    currentMode: Mode;
    onModeChange: (mode: Mode) => void;
    gp2040Enabled?: boolean;
};

export function ModeTabs({ currentMode, onModeChange, gp2040Enabled = false }: Props) {
    return (
        <div className="mode-tabs">
            <button
                className={`mode-tab ${currentMode === 'orca' ? 'active' : ''}`}
                onClick={() => onModeChange('orca')}
            >
                Orca Mode (Primary)
            </button>
            <button
                className={`mode-tab ${currentMode === 'gp2040' ? 'active' : ''} ${!gp2040Enabled ? 'disabled' : ''}`}
                onClick={() => gp2040Enabled && onModeChange('gp2040')}
                title={!gp2040Enabled ? 'Secondary slot not supported by connected firmware' : undefined}
            >
                GP2040 Mode (Secondary)
            </button>
        </div>
    );
}
