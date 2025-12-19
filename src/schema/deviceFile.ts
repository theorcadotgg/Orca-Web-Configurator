/**
 * Device file format for exporting/importing both Orca and GP2040 mode configurations.
 */

export const ORCA_DEVICE_FILE_TYPE = 'orca-device';
export const ORCA_DEVICE_FILE_VERSION = 1 as const;

export type OrcaDeviceFileV1 = {
    type: typeof ORCA_DEVICE_FILE_TYPE;
    version: typeof ORCA_DEVICE_FILE_VERSION;
    timestamp: string;
    orcaSlot: string | null; // Base64-encoded binary blob
    gp2040Slot: string | null; // Base64-encoded binary blob
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function expectRecord(value: unknown, name: string): Record<string, unknown> {
    if (!isRecord(value)) throw new Error(`Invalid ${name}: expected an object`);
    return value;
}

function expectString(value: unknown, name: string): string {
    if (typeof value !== 'string') throw new Error(`Invalid ${name}: expected a string`);
    return value;
}

function expectFiniteNumber(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Invalid ${name}: expected a finite number`);
    }
    return value;
}

function expectStringOrNull(value: unknown, name: string): string | null {
    if (value === null) return null;
    return expectString(value, name);
}

/**
 * Convert Uint8Array to Base64 string
 */
function blobToBase64(blob: Uint8Array): string {
    let binary = '';
    const len = blob.length;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(blob[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToBlob(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Serialize device configuration to JSON format
 */
export function serializeDeviceFileV1(orcaSlot: Uint8Array | null, gp2040Slot: Uint8Array | null): string {
    const file: OrcaDeviceFileV1 = {
        type: ORCA_DEVICE_FILE_TYPE,
        version: ORCA_DEVICE_FILE_VERSION,
        timestamp: new Date().toISOString(),
        orcaSlot: orcaSlot ? blobToBase64(orcaSlot) : null,
        gp2040Slot: gp2040Slot ? blobToBase64(gp2040Slot) : null,
    };
    return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * Parse device configuration from JSON format
 */
export function parseDeviceFileV1(jsonText: string): { orcaSlot: Uint8Array | null; gp2040Slot: Uint8Array | null } {
    let raw: unknown;
    try {
        raw = JSON.parse(jsonText);
    } catch {
        throw new Error('Invalid JSON');
    }

    const rec = expectRecord(raw, 'device file');
    const type = expectString(rec.type, 'device file.type');
    if (type !== ORCA_DEVICE_FILE_TYPE) {
        throw new Error(`Unsupported device file type: ${type}`);
    }

    const version = expectFiniteNumber(rec.version, 'device file.version');
    if (version !== ORCA_DEVICE_FILE_VERSION) {
        throw new Error(`Unsupported device file version: ${version}`);
    }

    const orcaSlotB64 = expectStringOrNull(rec.orcaSlot, 'device file.orcaSlot');
    const gp2040SlotB64 = expectStringOrNull(rec.gp2040Slot, 'device file.gp2040Slot');

    return {
        orcaSlot: orcaSlotB64 ? base64ToBlob(orcaSlotB64) : null,
        gp2040Slot: gp2040SlotB64 ? base64ToBlob(gp2040SlotB64) : null,
    };
}
