import type { BusEntityId } from './base-protocol';

export const LIGHT_GROUP_ID = 0x07;

export const LIGHT_STATE_REQUEST = 0x01;
export const LIGHT_STATE = 0x02;
export const LIGHT_SET_REQUEST = 0x03;
export const LIGHT_SET_RESPONSE = 0x04;

export const LIGHT_CHANNEL_WARM = 0x01;
export const LIGHT_CHANNEL_COLD = 0x02;
export const LIGHT_CHANNEL_RED = 0x04;
export const LIGHT_CHANNEL_GREEN = 0x08;
export const LIGHT_CHANNEL_BLUE = 0x10;
export const LIGHT_CHANNEL_MASK = 0x1f;

export const LIGHT_CAPABILITY_TRANSITION = 0x20;

export const LIGHT_RESULT_OK = 0x00;
export const LIGHT_RESULT_INVALID_REQUEST = 0x01;
export const LIGHT_RESULT_NOT_FOUND = 0x02;
export const LIGHT_RESULT_UNSUPPORTED = 0x03;
export const LIGHT_RESULT_INTERNAL_ERROR = 0x04;
export const LIGHT_RESULT_STATE_CHANGED = 0x05;

export type LightStateRequest = {
  id: BusEntityId;
};

export type LightState = {
  board: string;
  id: BusEntityId;
  result: number;
  timestampMs: number;
  capabilities: number;
  warmLevel: number;
  coldLevel: number;
  redLevel: number;
  greenLevel: number;
  blueLevel: number;
  transitionMs?: number;
};

export type LightSetRequest = {
  id: BusEntityId;
  channels: number;
  warmLevel: number;
  coldLevel: number;
  redLevel: number;
  greenLevel: number;
  blueLevel: number;
  transitionMs: number;
};

export type LightSetResponse = {
  board: string;
  id: BusEntityId;
  result: number;
};
