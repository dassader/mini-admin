import { useEffect, useState } from 'preact/hooks';
import { VirtualMotionSensor } from '../virtual/VirtualMotionSensor';
import type { AppIcon } from '../icons';
import { AppButton } from './AppButton';
import { DeviceCard } from './DeviceCard';

type ManualMotionSensorCardProps = {
  title: string;
  sensor: VirtualMotionSensor;
  icon: AppIcon;
};

const stateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export function ManualMotionSensorCard({
  title,
  sensor,
  icon: Icon
}: ManualMotionSensorCardProps) {
  const [snapshot, setSnapshot] = useState(() => sensor.getSnapshot());

  useEffect(
    () => sensor.subscribe(() => setSnapshot(sensor.getSnapshot())),
    [sensor]
  );

  const triggeredAt =
    snapshot.lastMotionAtMs === null
      ? 'Never'
      : stateTimeFormatter.format(new Date(snapshot.lastMotionAtMs));

  return (
    <DeviceCard
      className="manual-card manual-motion-card"
      deviceId={`manual-${sensor.id}`}
    >
      <header class="manual-card__header">
        <h2>{title}</h2>
        <dl class="sensor-fields">
          <div>
            <dt>Target:</dt>
            <dd>{sensor.id}</dd>
          </div>
          <div>
            <dt>Triggered at:</dt>
            <dd>{triggeredAt}</dd>
          </div>
        </dl>
      </header>

      <div class="manual-card__controls">
        <AppButton
          icon={Icon}
          label="Trigger motion"
          onClick={() => sensor.trigger()}
          variant="primary"
        />
      </div>
    </DeviceCard>
  );
}
