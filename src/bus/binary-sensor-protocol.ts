import type { BusEntityId } from './base-protocol';

export const BINARY_SENSOR_GROUP_ID = 0x08;

export const BINARY_SENSOR_STATE_REQUEST = 0x01;
export const BINARY_SENSOR_STATE = 0x02;

export const BINARY_SENSOR_CLASS_MOTION = 0x02;

export const BINARY_SENSOR_RESULT_OK = 0x00;
export const BINARY_SENSOR_RESULT_INVALID_REQUEST = 0x01;
export const BINARY_SENSOR_RESULT_NOT_FOUND = 0x02;
export const BINARY_SENSOR_RESULT_UNSUPPORTED = 0x03;
export const BINARY_SENSOR_RESULT_INTERNAL_ERROR = 0x04;
export const BINARY_SENSOR_RESULT_STATE_CHANGED = 0x05;

export type BinarySensorStateRequest = {
  id: BusEntityId;
};

export type BinarySensorState = {
  board: string;
  id: BusEntityId;
  result: number;
  sensorClass: number;
  timestampMs: number;
  value: 0 | 1;
};
