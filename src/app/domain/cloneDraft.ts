import type { SettingsDraft } from '../../schema/settingsBlob';

export function cloneDraft(draft: SettingsDraft): SettingsDraft {
  return {
    ...draft,
    profileLabels: [...draft.profileLabels],
    digitalMappings: draft.digitalMappings.map((m) => [...m]),
    analogMappings: draft.analogMappings.map((m) => [...m]),
    dpadLayer: draft.dpadLayer.map((layer) => ({
      ...layer,
      enable: { ...layer.enable },
      up: { ...layer.up },
      down: { ...layer.down },
      left: { ...layer.left },
      right: { ...layer.right },
    })),
    triggerPolicy: draft.triggerPolicy.map((policy) => ({ ...policy })),
    stickCurveParams: draft.stickCurveParams.map((p) => ({
      ...p,
      range: [...p.range],
      notch: [...p.notch],
      dz_lower: [...p.dz_lower],
      dz_upper: [...p.dz_upper],
    })),
  };
}

