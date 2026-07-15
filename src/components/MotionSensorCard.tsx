import { useEffect, useState } from 'preact/hooks';
import {
  BUS_DESTINATION_BROADCAST,
  type BusEntityId
} from '../bus/base-protocol';
import {
  BINARY_SENSOR_GROUP_ID,
  BINARY_SENSOR_RESULT_OK,
  BINARY_SENSOR_RESULT_STATE_CHANGED,
  BINARY_SENSOR_STATE,
  BINARY_SENSOR_STATE_REQUEST,
  type BinarySensorState
} from '../bus/binary-sensor-protocol';
import type { Bus } from '../bus/bus';
import type { AppIcon } from '../icons';
import { DeviceCard } from './DeviceCard';

export type MotionSensorCardProps = {
  id: string;
  entityId: BusEntityId;
  title: string;
  bus: Bus;
  icon: AppIcon;
};

const stateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export function MotionSensorCard({
  id,
  entityId,
  title,
  bus,
  icon: Icon
}: MotionSensorCardProps) {
  const [state, setState] = useState<BinarySensorState | null>(null);

  useEffect(() => {
    const unsubscribe = bus.listen((message) => {
      if (
        message.group !== BINARY_SENSOR_GROUP_ID ||
        message.type !== BINARY_SENSOR_STATE
      ) return;

      const payload = message.payload as Partial<BinarySensorState> | undefined;
      if (!payload || payload.id !== entityId) return;

      if (
        payload.result !== BINARY_SENSOR_RESULT_OK &&
        payload.result !== BINARY_SENSOR_RESULT_STATE_CHANGED
      ) return;

      setState(payload as BinarySensorState);
    });

    bus.send({
      destination: BUS_DESTINATION_BROADCAST,
      group: BINARY_SENSOR_GROUP_ID,
      type: BINARY_SENSOR_STATE_REQUEST,
      payload: { id: entityId }
    });

    return unsubscribe;
  }, [bus, entityId]);

  const isMotion = state?.value !== undefined && state.value !== 0;
  const status = state === null ? 'Unknown' : isMotion ? 'Motion' : 'Idle';
  const changedAt =
    state?.timestampMs === undefined || state.timestampMs === 0
      ? 'Unknown'
      : stateTimeFormatter.format(new Date(state.timestampMs));

  return (
    <DeviceCard className={`motion-sensor-card motion-sensor-card--${isMotion ? 'motion' : 'idle'}`}>
      <header class="motion-sensor-card__header">
        <h2>{title}</h2>
        <dl class="motion-sensor-card__fields">
          <div>
            <dt>Id:</dt>
            <dd>{id}</dd>
          </div>
          <div>
            <dt>Changed at:</dt>
            <dd>{changedAt}</dd>
          </div>
          <div>
            <dt>Status:</dt>
            <dd class="motion-sensor-card__status">{status}</dd>
          </div>
        </dl>
      </header>

      <div class="motion-sensor-card__icon" aria-label={`${id} ${status}`}>
        <Icon size={52} strokeWidth={1.9} aria-hidden />
      </div>
    </DeviceCard>
  );
}
