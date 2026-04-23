import { describe, expect, it } from 'vitest';
import { OrcaCmd, OrcaMsgType } from '@shared/orca_config_idl_generated';
import {
  encodeGetGp2040InputModeRequest,
  encodeSetGp2040InputModeRequest,
  tryDecodeFrameFromBuffer,
} from './orcaProtocol';

function readU32Le(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

describe('orcaProtocol GP2040 input mode commands', () => {
  it('encodes GET_GP2040_INPUT_MODE requests', () => {
    const frame = tryDecodeFrameFromBuffer(encodeGetGp2040InputModeRequest(7));
    expect(frame).not.toBeNull();
    expect(frame!.remaining).toHaveLength(0);
    expect(frame!.frame.msgType).toBe(OrcaMsgType.REQUEST);
    expect(frame!.frame.seq).toBe(7);
    expect(Array.from(frame!.frame.payload)).toEqual([OrcaCmd.GET_GP2040_INPUT_MODE]);
  });

  it('encodes SET_GP2040_INPUT_MODE requests', () => {
    const frame = tryDecodeFrameFromBuffer(encodeSetGp2040InputModeRequest(11, 13));
    expect(frame).not.toBeNull();
    expect(frame!.frame.msgType).toBe(OrcaMsgType.REQUEST);
    expect(frame!.frame.seq).toBe(11);
    expect(frame!.frame.payload[0]).toBe(OrcaCmd.SET_GP2040_INPUT_MODE);
    expect(readU32Le(frame!.frame.payload, 4)).toBe(13);
  });
});
