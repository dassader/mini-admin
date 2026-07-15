export {
  BUS_DESTINATION_BROADCAST,
  SIMULATOR_BOARD_ID
} from './base-protocol';

export const SYSTEM_GROUP_ID = 0x01;

export const SYSTEM_TIMER_START_REQUEST = 0x0e;
export const SYSTEM_TIMER_START_RESPONSE = 0x0f;
export const SYSTEM_TIMER_CANCEL_REQUEST = 0x10;
export const SYSTEM_TIMER_CANCEL_RESPONSE = 0x11;
export const SYSTEM_TIMER_EVENT = 0x12;
export const SYSTEM_TIMER_LIST_REQUEST = 0x13;
export const SYSTEM_TIMER_LIST_RESPONSE = 0x14;

export const SYSTEM_TIMER_RESULT_OK = 0x00;
export const SYSTEM_TIMER_RESULT_INVALID_NAME = 0x01;
export const SYSTEM_TIMER_RESULT_NOT_FOUND = 0x02;
export const SYSTEM_TIMER_RESULT_NO_SLOT = 0x03;
export const SYSTEM_TIMER_RESULT_INTERNAL_ERROR = 0x04;

export const SYSTEM_TIMER_EVENT_REASON_CANCELED = 0x01;
export const SYSTEM_TIMER_EVENT_REASON_EXPIRED = 0x02;

export type SystemTimerStartRequest = {
  timerId: string;
  timeoutMs: number;
};

export type SystemTimerStartResponse = {
  board: string;
  timerId: string;
  result: number;
  generation: number;
};

export type SystemTimerCancelRequest = {
  timerId: string;
};

export type SystemTimerCancelResponse = {
  board: string;
  timerId: string;
  result: number;
  generation: number;
};

export type SystemTimerEvent = {
  board: string;
  timerId: string;
  reason: number;
  generation: number;
};

export type SystemTimerListRequest = Record<string, never>;

export type SystemTimerListResponse = {
  board: string;
  timerId: string;
  running: 0 | 1;
  timeoutMs: number;
  remainingMs: number;
  generation: number;
};
