import { useEffect, useState } from 'preact/hooks';
import { VirtualButton } from '../virtual/VirtualButton';
import { AppButton } from './AppButton';
import { DeviceCard } from './DeviceCard';

type ManualButtonControlCardProps = {
  title: string;
  button: VirtualButton;
};

export function ManualButtonControlCard({
  title,
  button
}: ManualButtonControlCardProps) {
  const [snapshot, setSnapshot] = useState(() => button.getSnapshot());

  useEffect(
    () => button.subscribe(() => setSnapshot(button.getSnapshot())),
    [button]
  );

  return (
    <DeviceCard
      className="manual-card manual-button-card"
      deviceId={`manual-${button.id}`}
    >
      <header class="manual-card__header">
        <h2>{title}</h2>
        <dl class="sensor-fields">
          <div>
            <dt>Target:</dt>
            <dd>{button.id}</dd>
          </div>
          <div>
            <dt>Sequence:</dt>
            <dd>{snapshot.sequence}</dd>
          </div>
        </dl>
      </header>

      <div class="manual-card__controls" aria-label={`${button.id} manual actions`}>
        <AppButton label="Click" onClick={() => button.click()} variant="primary" />
        <AppButton label="Double" onClick={() => button.doubleClick()} variant="ghost" />
        <AppButton label="Press" onClick={() => button.press()} variant="neutral" />
      </div>
    </DeviceCard>
  );
}
