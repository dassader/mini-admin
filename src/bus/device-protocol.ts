import type { BusEntityId } from './base-protocol';

export const DEVICE_GROUP_ID = 0x06;

export const DEVICE_LIST_REQUEST = 0x01;
export const DEVICE_STATE = 0x02;

export const DEVICE_TYPE_LIGHT = 0x00;
export const DEVICE_TYPE_BINARY_SENSOR = 0x01;
export const DEVICE_TYPE_NUMERIC_SENSOR = 0x02;
export const DEVICE_TYPE_BUTTON = 0x03;

export const DEVICE_RESULT_OK = 0x00;
export const DEVICE_RESULT_INVALID_REQUEST = 0x01;
export const DEVICE_RESULT_INTERNAL_ERROR = 0x02;
export const DEVICE_RESULT_STATE_CHANGED = 0x03;

export type DeviceListRequest = Record<string, never>;

export type DeviceState = {
  board: string;
  result: number;
  id: BusEntityId;
  type: number;
  subtype: number;
  timestampMs: number;
};
