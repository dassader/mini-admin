import { useEffect, useState } from 'preact/hooks';
import {
  BUS_DESTINATION_BROADCAST,
  type BusEntityId
} from '../bus/base-protocol';
import type { Bus } from '../bus/bus';
import {
  NUMERIC_SENSOR_GROUP_ID,
  NUMERIC_SENSOR_RESULT_OK,
  NUMERIC_SENSOR_RESULT_STATE_CHANGED,
  NUMERIC_SENSOR_STATE,
  NUMERIC_SENSOR_STATE_REQUEST,
  type NumericSensorState
} from '../bus/numeric-sensor-protocol';
import { DeviceCard } from './DeviceCard';

export type LightSensorCardProps = {
  id: string;
  entityId: BusEntityId;
  title: string;
  bus: Bus;
};

const stateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export function LightSensorCard({
  id,
  entityId,
  title,
  bus
}: LightSensorCardProps) {
  const [state, setState] = useState<NumericSensorState | null>(null);

  useEffect(() => {
    const unsubscribe = bus.listen((message) => {
      if (
        message.group !== NUMERIC_SENSOR_GROUP_ID ||
        message.type !== NUMERIC_SENSOR_STATE
      ) return;

      const payload = message.payload as Partial<NumericSensorState> | undefined;
      if (!payload || payload.id !== entityId) return;

      if (
        payload.result !== NUMERIC_SENSOR_RESULT_OK &&
        payload.result !== NUMERIC_SENSOR_RESULT_STATE_CHANGED
      ) return;

      setState(payload as NumericSensorState);
    });

    bus.send({
      destination: BUS_DESTINATION_BROADCAST,
      group: NUMERIC_SENSOR_GROUP_ID,
      type: NUMERIC_SENSOR_STATE_REQUEST,
      payload: { id: entityId }
    });

    return unsubscribe;
  }, [bus, entityId]);

  const changedAt =
    state?.timestampMs === undefined || state.timestampMs === 0
      ? 'Unknown'
      : stateTimeFormatter.format(new Date(state.timestampMs));
  const value = state ? formatNumericValue(state) : 'Unknown';

  return (
    <DeviceCard className="light-sensor-card">
      <header class="light-sensor-card__header">
        <h2>{title}</h2>
        <dl class="sensor-fields">
          <div>
            <dt>Id:</dt>
            <dd>{id}</dd>
          </div>
          <div>
            <dt>Changed at:</dt>
            <dd>{changedAt}</dd>
          </div>
          <div>
            <dt>Value:</dt>
            <dd>{value}</dd>
          </div>
        </dl>
      </header>
    </DeviceCard>
  );
}

function formatNumericValue(state: NumericSensorState) {
  const value = state.rawValue * 10 ** state.scale;

  return `${Number.isInteger(value) ? value : value.toFixed(2)} lx`;
}
