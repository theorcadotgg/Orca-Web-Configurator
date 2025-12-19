import type { ProfileMode } from '../../schema/profileFile';

export type SlotId = 0 | 1;
export type SlotMode = ProfileMode;

export function modeToSlotId(mode: SlotMode): SlotId {
  return mode === 'gp2040' ? 1 : 0;
}

export function slotSuffix(slot: SlotId): string {
  return slot === 0 ? 'primary' : 'secondary';
}

export function slotDisplayName(slot: SlotId): string {
  return slot === 0 ? 'Orca Mode (Primary)' : 'GP2040 Mode (Secondary)';
}

