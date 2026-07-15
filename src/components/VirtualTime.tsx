import type { TimeController, TimeJump } from '../domain/time';
import { AppButton } from './AppButton';
import { DeviceCard } from './DeviceCard';

type VirtualTimeProps = {
  id: string;
  title: string;
  time: TimeController;
  jumps: TimeJump[];
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export function VirtualTime({ id, title, time, jumps }: VirtualTimeProps) {
  return (
    <DeviceCard className="virtual-time-card">
      <header class="virtual-time-card__header">
        <h2>{title}</h2>
        <dl class="sensor-fields">
          <div>
            <dt>Id:</dt>
            <dd>{id}</dd>
          </div>
          <div>
            <dt>Time:</dt>
            <dd>{timeFormatter.format(time.current)}</dd>
          </div>
        </dl>
      </header>

      <div class="virtual-time-card__controls" aria-label="Virtual time controls">
        {jumps.map((jump) => (
          <AppButton
            key={jump.id}
            label={jump.label}
            variant="ghost"
            onClick={() => time.shiftByMs(jump.offsetMs)}
          />
        ))}
      </div>
    </DeviceCard>
  );
}
