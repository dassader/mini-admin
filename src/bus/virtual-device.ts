import type { Bus } from './bus';
import {
  BUS_DESTINATION_BROADCAST,
  SIMULATOR_BOARD_ID,
  type BusEntityId
} from './base-protocol';
import {
  DEVICE_GROUP_ID,
  DEVICE_RESULT_OK,
  DEVICE_STATE,
  type DeviceState
} from './device-protocol';

export type VirtualDeviceDescriptor = {
  id: BusEntityId;
  type: number;
  subtype: number;
};

export function publishDeviceState(
  bus: Bus,
  descriptor: VirtualDeviceDescriptor,
  timestampMs: number,
  result = DEVICE_RESULT_OK
) {
  bus.send<DeviceState>({
    destination: BUS_DESTINATION_BROADCAST,
    group: DEVICE_GROUP_ID,
    type: DEVICE_STATE,
    createdAtMs: timestampMs,
    payload: {
      board: SIMULATOR_BOARD_ID,
      result,
      id: descriptor.id,
      type: descriptor.type,
      subtype: descriptor.subtype,
      timestampMs
    }
  });
}
