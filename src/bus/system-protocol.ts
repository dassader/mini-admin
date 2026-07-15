export const SYSTEM_DISCOVERY_REQUEST = 0x01;
export const SYSTEM_DISCOVERY_RESPONSE = 0x02;
export const SYSTEM_PING_REQUEST = 0x03;
export const SYSTEM_PING_RESPONSE = 0x04;
export const SYSTEM_STATUS_REQUEST = 0x06;
export const SYSTEM_STATUS_RESPONSE = 0x07;

export const SYSTEM_RESET_REASON_POWERON = 0x01;

export type SystemDiscoveryResponse = {
  board: string;
};

export type SystemPingResponse = {
  board: string;
};

export type SystemStatusResponse = {
  board: string;
  resetReason: number;
  uptimeMs: number;
};
