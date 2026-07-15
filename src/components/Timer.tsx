import { AppButton } from './AppButton';
import { DeviceCard } from './DeviceCard';

export type TimerMode = 'idle' | 'running';

export type TimerProps = {
  id: string;
  title: string;
  timeoutMs: number;
  startedAtMs: number | null;
  mode: TimerMode;
  remainingMs: number;
  onStart: () => void;
};

const startedAtFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export function Timer({
  id,
  title,
  timeoutMs,
  startedAtMs,
  mode,
  remainingMs,
  onStart
}: TimerProps) {
  const isRunning = mode === 'running';
  const startedAt =
    startedAtMs === null ? 'Never' : startedAtFormatter.format(new Date(startedAtMs));
  const status = isRunning ? formatCountdown(remainingMs) : 'Idle';

  return (
    <DeviceCard className={`timer timer--${mode}`}>
      <header class="timer__header">
        <h2>{title}</h2>
        <dl class="sensor-fields">
          <div>
            <dt>Id:</dt>
            <dd>{id}</dd>
          </div>
          <div>
            <dt>Started at:</dt>
            <dd>{startedAt}</dd>
          </div>
          <div>
            <dt>Timeout:</dt>
            <dd>{formatDuration(timeoutMs)}</dd>
          </div>
          <div>
            <dt>Status:</dt>
            <dd class="timer__status">{status}</dd>
          </div>
        </dl>
      </header>

      <div class="timer__controls">
        <AppButton
          label={isRunning ? 'Restart' : 'Start'}
          onClick={onStart}
          variant={isRunning ? 'ghost' : 'primary'}
        />
      </div>
    </DeviceCard>
  );
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.ceil(milliseconds / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1_000) {
    return `${milliseconds}ms`;
  }

  const totalSeconds = Math.round(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds.toString().padStart(hours > 0 || minutes > 0 ? 2 : 1, '0')}s`);

  return parts.join(' ');
}
