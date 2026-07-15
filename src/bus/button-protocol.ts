import type { BusEntityId } from './base-protocol';

export const BUTTON_GROUP_ID = 0x0a;

export const BUTTON_ACTION = 0x01;

export const BUTTON_ACTION_SINGLE_CLICK = 0x00;
export const BUTTON_ACTION_DOUBLE_CLICK = 0x01;
export const BUTTON_ACTION_TRIPLE_CLICK = 0x02;
export const BUTTON_ACTION_HOLD_START = 0x03;
export const BUTTON_ACTION_HOLD_RELEASE = 0x04;

export type ButtonActionMessage = {
  board: string;
  id: BusEntityId;
  action: number;
  timestampMs: number;
  sequence: number;
};
