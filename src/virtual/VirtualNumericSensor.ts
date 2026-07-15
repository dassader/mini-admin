import type { Bus } from '../bus/bus';
import {
  acceptsDestination,
  BUS_DESTINATION_BROADCAST,
  isValidEntityId,
  SIMULATOR_BOARD_ID,
  type BusEntityId
} from '../bus/base-protocol';
import {
  DEVICE_GROUP_ID,
  DEVICE_LIST_REQUEST,
  DEVICE_TYPE_NUMERIC_SENSOR
} from '../bus/device-protocol';
import {
  NUMERIC_SENSOR_GROUP_ID,
  NUMERIC_SENSOR_RESULT_INVALID_REQUEST,
  NUMERIC_SENSOR_RESULT_OK,
  NUMERIC_SENSOR_RESULT_STATE_CHANGED,
  NUMERIC_SENSOR_STATE,
  NUMERIC_SENSOR_STATE_REQUEST,
  type NumericSensorState,
  type NumericSensorStateRequest
} from '../bus/numeric-sensor-protocol';
import { publishDeviceState } from '../bus/virtual-device';
import { VirtualDeviceEvents } from './virtual-device-events';

type VirtualNumericSensorOptions = {
  id: string;
  entityId: BusEntityId;
  sensorClass: number;
  initialRawValue: number;
  scale?: number;
  minRawValue?: number;
  maxRawValue?: number;
  getTimeMs: () => number;
};

export class VirtualNumericSensor extends VirtualDeviceEvents {
  readonly id: string;
  readonly entityId: BusEntityId;
  readonly sensorClass: number;
  readonly scale: number;
  readonly minRawValue: number;
  readonly maxRawValue: number;

  private bus: Bus | null = null;
  private rawValue: number;
  private lastChangedAtMs: number | null = null;
  private readonly getTimeMs: () => number;

  constructor({
    id,
    entityId,
    sensorClass,
    initialRawValue,
    scale = 0,
    minRawValue = Number.MIN_SAFE_INTEGER,
    maxRawValue = Number.MAX_SAFE_INTEGER,
    getTimeMs
  }: VirtualNumericSensorOptions) {
    super();
    this.id = id;
    this.entityId = entityId;
    this.sensorClass = sensorClass;
    this.scale = scale;
    this.minRawValue = minRawValue;
    this.maxRawValue = maxRawValue;
    this.rawValue = this.clampRawValue(initialRawValue);
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
            type: DEVICE_TYPE_NUMERIC_SENSOR,
            subtype: this.sensorClass
          },
          this.getTimeMs()
        );
        return;
      }

      if (
        message.group !== NUMERIC_SENSOR_GROUP_ID ||
        message.type !== NUMERIC_SENSOR_STATE_REQUEST
      ) return;

      const payload = (message.payload ?? {}) as Partial<NumericSensorStateRequest>;

      if (!isValidEntityId(payload.id)) {
        this.publishState(NUMERIC_SENSOR_RESULT_INVALID_REQUEST, 0, 0);
        return;
      }

      if (payload.id !== this.entityId) {
        return;
      }

      this.publishState(NUMERIC_SENSOR_RESULT_OK, this.rawValue, this.entityId);
    });
  }

  setRawValue(nextRawValue: number) {
    this.rawValue = this.clampRawValue(nextRawValue);
    this.lastChangedAtMs = this.getTimeMs();
    this.publishState(
      NUMERIC_SENSOR_RESULT_STATE_CHANGED,
      this.rawValue,
      this.entityId,
      this.lastChangedAtMs
    );
    this.notifyListeners();
  }

  getSnapshot() {
    return {
      id: this.id,
      entityId: this.entityId,
      sensorClass: this.sensorClass,
      rawValue: this.rawValue,
      scale: this.scale,
      lastChangedAtMs: this.lastChangedAtMs
    };
  }

  private publishState(
    result: number,
    rawValue: number,
    entityId: BusEntityId,
    timestampMs = this.getTimeMs()
  ) {
    if (!this.bus) return;

    const isSuccess =
      result === NUMERIC_SENSOR_RESULT_OK ||
      result === NUMERIC_SENSOR_RESULT_STATE_CHANGED;

    this.bus.send<NumericSensorState>({
      destination: BUS_DESTINATION_BROADCAST,
      group: NUMERIC_SENSOR_GROUP_ID,
      type: NUMERIC_SENSOR_STATE,
      createdAtMs: timestampMs,
      payload: {
        board: SIMULATOR_BOARD_ID,
        id: entityId,
        result,
        sensorClass: isSuccess ? this.sensorClass : 0,
        timestampMs: isSuccess ? timestampMs : 0,
        rawValue: isSuccess ? rawValue : 0,
        scale: isSuccess ? this.scale : 0
      }
    });
  }

  private clampRawValue(value: number) {
    return Math.min(
      Math.max(Math.round(value), this.minRawValue),
      this.maxRawValue
    );
  }
}
