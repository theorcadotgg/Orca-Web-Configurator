import { ORCA_CONFIG_SETTINGS_PROFILE_COUNT } from '@shared/orca_config_idl_generated';
import { isGp2040LabelPreset } from '../../schema/gp2040Labels';
import { useOrcaApp } from '../contexts/OrcaAppContext';
import { ControllerVisualizer } from '../components/ControllerVisualizer';
import { LiveInputPreviewCard } from '../components/LiveInputPreviewCard';

export function MainPane() {
  const {
    state,
    mainView,
    setMainView,
    gp2040LabelPreset,
    setGp2040LabelPreset,
    baseBlob,
    draft,
    activeProfile,
    digitalMapping,
    analogMapping,
    defaultDigitalMapping,
    defaultAnalogMapping,
    gp2040AnalogTriggerOutput,
    remappedCount,
    connect,
    setActiveProfile,
    renameProfile,
    setDigitalMapping,
    setAnalogMapping,
    clearAllBindings,
    resetToDefaultBindings,
    setEditingProfile,
  } = useOrcaApp();

  return (
    <main className="layout-main">
      <div className="main-content">
        {state.lastError && <div className="message message-error mb-md">{state.lastError}</div>}

        {!state.transport ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 'var(--spacing-lg)',
            }}
          >
            <h2 style={{ margin: 0, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Connect your Orca controller
            </h2>
            <button className="primary" onClick={() => void connect()} disabled={state.busy}>
              {state.busy ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        ) : draft ? (
          <div className="main-hero">
            <div className="profile-tabs">
              {Array.from({ length: ORCA_CONFIG_SETTINGS_PROFILE_COUNT }, (_, i) => {
                const isEditing = state.editingProfile === i;
                const label = draft.profileLabels[i]?.trim() || `Profile ${i + 1}`;

                return (
                  <button
                    key={i}
                    className={`profile-tab ${activeProfile === i ? 'active' : ''}`}
                    onClick={() => !isEditing && setActiveProfile(i)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      if (!state.busy) {
                        setEditingProfile(i);
                        setTimeout(() => {
                          const input = document.getElementById(`profile-input-${i}`) as HTMLInputElement;
                          input?.select();
                        }, 0);
                      }
                    }}
                    disabled={state.busy}
                  >
                    {isEditing ? (
                      <input
                        id={`profile-input-${i}`}
                        type="text"
                        className="profile-tab-input"
                        defaultValue={label}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            renameProfile(i, e.currentTarget.value);
                            setEditingProfile(null);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingProfile(null);
                          }
                        }}
                        onBlur={(e) => {
                          renameProfile(i, e.currentTarget.value);
                          setEditingProfile(null);
                        }}
                      />
                    ) : (
                      label
                    )}
                  </button>
                );
              })}
            </div>

            <div className="row mb-md">
              <div className="flex-1" />
              <div className="mode-tabs" style={{ marginLeft: 0 }}>
                <button
                  className={`mode-tab ${mainView === 'layout' ? 'active' : ''}`}
                  onClick={() => setMainView('layout')}
                  type="button"
                >
                  Layout
                </button>
                <button
                  className={`mode-tab ${mainView === 'inputs' ? 'active' : ''}`}
                  onClick={() => setMainView('inputs')}
                  type="button"
                >
                  Inputs
                </button>
              </div>
              <div className="flex-1 row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {state.configMode === 'gp2040' && (
                  <>
                    <span className="text-sm text-secondary">Button labels</span>
                    <select
                      value={gp2040LabelPreset}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (isGp2040LabelPreset(value)) setGp2040LabelPreset(value);
                      }}
                      disabled={state.busy}
                      style={{ minWidth: 220 }}
                    >
                      <option value="gp2040">GP2040 (B1/B2/B3/B4)</option>
                      <option value="xbox">Xbox (A/B/X/Y)</option>
                      <option value="switch">Switch (B/A/Y/X)</option>
                      <option value="playstation">PlayStation (✕/○/□/△)</option>
                    </select>
                  </>
                )}
              </div>
            </div>

            {mainView === 'layout' ? (
              <>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 0,
                    padding: 'var(--spacing-md) 0',
                  }}
                >
                  <ControllerVisualizer
                    digitalMapping={digitalMapping}
                    analogMapping={analogMapping}
                    defaultDigitalMapping={defaultDigitalMapping}
                    defaultAnalogMapping={defaultAnalogMapping}
                    disabled={state.busy}
                    destinationLabelMode={state.configMode}
                    gp2040LabelPreset={gp2040LabelPreset}
                    gp2040AnalogTriggerRouting={gp2040AnalogTriggerOutput}
                    dpadLayer={draft.dpadLayer[activeProfile]}
                    onDigitalMappingChange={setDigitalMapping}
                    onAnalogMappingChange={setAnalogMapping}
                    onClearAllBindings={clearAllBindings}
                    onResetToDefault={resetToDefaultBindings}
                  />
                </div>

                {remappedCount > 0 && (
                  <div className="text-center text-sm text-secondary">
                    {remappedCount} button{remappedCount > 1 ? 's' : ''} remapped
                  </div>
                )}
              </>
            ) : mainView === 'inputs' && baseBlob ? (
              <LiveInputPreviewCard
                transport={state.transport}
                draft={draft}
                baseBlob={baseBlob}
                disabled={state.busy}
                style={{ marginTop: 0 }}
              />
            ) : (
              <div className="text-sm text-muted">No settings loaded</div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
