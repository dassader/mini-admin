import type { Bus } from '../bus/bus';
import {
  acceptsDestination,
  BUS_DESTINATION_BROADCAST,
  isValidEntityId,
  SIMULATOR_BOARD_ID,
  type BusEntityId
} from '../bus/base-protocol';
import {
  BINARY_SENSOR_CLASS_MOTION,
  BINARY_SENSOR_GROUP_ID,
  BINARY_SENSOR_RESULT_INVALID_REQUEST,
  BINARY_SENSOR_RESULT_OK,
  BINARY_SENSOR_RESULT_STATE_CHANGED,
  BINARY_SENSOR_STATE,
  BINARY_SENSOR_STATE_REQUEST,
  type BinarySensorState,
  type BinarySensorStateRequest
} from '../bus/binary-sensor-protocol';
import {
  DEVICE_GROUP_ID,
  DEVICE_LIST_REQUEST,
  DEVICE_TYPE_BINARY_SENSOR
} from '../bus/device-protocol';
import { publishDeviceState } from '../bus/virtual-device';
import { getMotionSensorSnapshot } from '../domain/motion-sensor';
import { VirtualDeviceEvents } from './virtual-device-events';

type VirtualMotionSensorOptions = {
  id: string;
  entityId: BusEntityId;
  idleAfterMs: number;
  getTimeMs: () => number;
};

export class VirtualMotionSensor extends VirtualDeviceEvents {
  readonly id: string;
  readonly entityId: BusEntityId;
  readonly idleAfterMs: number;

  private bus: Bus | null = null;
  private lastMotionAtMs: number | null = null;
  private publishedValue: 0 | 1 = 0;
  private readonly getTimeMs: () => number;

  constructor({
    id,
    entityId,
    idleAfterMs,
    getTimeMs
  }: VirtualMotionSensorOptions) {
    super();
    this.id = id;
    this.entityId = entityId;
    this.idleAfterMs = idleAfterMs;
    this.getTimeMs = getTimeMs;
  }

  connect(bus: Bus) {
    this.bus = bus;

    return bus.listen((message) => {
      if (!acceptsDestination(message)) return;

      if (
        message.group === DEVICE_GROUP_ID &&
        message.type === DEVICE_LIST_REQUEST
      ) {
        publishDeviceState(
          bus,
          {
            id: this.entityId,
            type: DEVICE_TYPE_BINARY_SENSOR,
            subtype: BINARY_SENSOR_CLASS_MOTION
          },
          this.getTimeMs()
        );
        return;
      }

      if (
        message.group !== BINARY_SENSOR_GROUP_ID ||
        message.type !== BINARY_SENSOR_STATE_REQUEST
      ) return;

      const payload = (message.payload ?? {}) as Partial<BinarySensorStateRequest>;

      if (!isValidEntityId(payload.id)) {
        this.publishState(BINARY_SENSOR_RESULT_INVALID_REQUEST, 0, 0);
        return;
      }

      if (payload.id !== this.entityId) {
        return;
      }

      this.publishState(
        BINARY_SENSOR_RESULT_OK,
        this.getCurrentValue(),
        this.entityId
      );
    });
  }

  trigger() {
    const timestampMs = this.getTimeMs();

    this.lastMotionAtMs = timestampMs;
    this.publishedValue = 1;
    this.publishState(BINARY_SENSOR_RESULT_STATE_CHANGED, 1, this.entityId);
    this.notifyListeners();
  }

  sync() {
    const currentValue = this.getCurrentValue();
    if (this.publishedValue === currentValue) return;

    this.publishedValue = currentValue;
    this.publishState(
      BINARY_SENSOR_RESULT_STATE_CHANGED,
      currentValue,
      this.entityId
    );
    this.notifyListeners();
  }

  getSnapshot() {
    return getMotionSensorSnapshot(
      {
        id: this.id,
        title: this.id,
        idleAfterMs: this.idleAfterMs,
        lastMotionAtMs: this.lastMotionAtMs
      },
      this.getTimeMs()
    );
  }

  private getCurrentValue(): 0 | 1 {
    if (this.lastMotionAtMs === null) return 0;

    return this.getTimeMs() - this.lastMotionAtMs < this.idleAfterMs ? 1 : 0;
  }

  private publishState(
    result: number,
    value: 0 | 1,
    entityId: BusEntityId,
    timestampMs = this.getTimeMs()
  ) {
    if (!this.bus) return;

    const isSuccess =
      result === BINARY_SENSOR_RESULT_OK ||
      result === BINARY_SENSOR_RESULT_STATE_CHANGED;

    this.bus.send<BinarySensorState>({
      destination: BUS_DESTINATION_BROADCAST,
      group: BINARY_SENSOR_GROUP_ID,
      type: BINARY_SENSOR_STATE,
      createdAtMs: timestampMs,
      payload: {
        board: SIMULATOR_BOARD_ID,
        id: entityId,
        result,
        sensorClass: isSuccess ? BINARY_SENSOR_CLASS_MOTION : 0,
        timestampMs: isSuccess ? timestampMs : 0,
        value: isSuccess ? value : 0
      }
    });
  }
}
