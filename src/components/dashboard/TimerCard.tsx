import { Clock3, RotateCcw, Square, TimerReset } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TimerState } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';

type TimerCardProps = {
  timer: TimerState;
  now: number;
  startTimer: (board: string, timerId: string, timeoutMs: number) => Promise<void>;
  cancelTimer: (board: string, timerId: string) => Promise<void>;
};

export function TimerCard({ timer, now, startTimer, cancelTimer }: TimerCardProps) {
  const [seconds, setSeconds] = useState(Math.max(1, Math.round(timer.timeoutMs / 1000) || 60));

  useEffect(() => {
    if (timer.timeoutMs > 0) setSeconds(Math.max(1, Math.round(timer.timeoutMs / 1000)));
  }, [timer.timeoutMs]);

  const remainingMs = timer.running
    ? Math.max(0, timer.remainingMs - (now - timer.snapshotAt))
    : 0;
  const running = timer.running && remainingMs > 0;
  const progress = timer.timeoutMs > 0 ? Math.max(0, Math.min(1, remainingMs / timer.timeoutMs)) : 0;

  return (
    <Card
      title="Timer"
      icon={<TimerReset size={21} />}
      className="entity-card timer-card"
      action={<span className={running ? 'live-label' : 'timer-status'}><span className="status-dot" />{running ? 'Running' : timer.reason === 2 ? 'Expired' : 'Stopped'}</span>}
    >
      <p className="entity-name">{timer.id}</p>
      <p className="entity-id">{timer.board}</p>
      <div className="timer-readout">
        <strong>{formatRemaining(remainingMs)}</strong>
        <span>generation {timer.generation}</span>
      </div>
      <div className="timer-progress" aria-label={`Timer progress ${Math.round(progress * 100)}%`}>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <label className="timer-duration">
        <span><Clock3 size={16} aria-hidden="true" />Timeout</span>
        <span><input type="number" min="1" max="4294967" value={seconds} onChange={(event) => setSeconds(Math.max(1, Number(event.currentTarget.value) || 1))} /> sec</span>
      </label>
      <div className="timer-actions">
        <button className="outline-button" type="button" onClick={() => void startTimer(timer.board, timer.id, seconds * 1000)}>
          <RotateCcw size={17} aria-hidden="true" />{running ? 'Restart' : 'Start'}
        </button>
        <button className="outline-button" type="button" disabled={!running} onClick={() => void cancelTimer(timer.board, timer.id)}>
          <Square size={16} aria-hidden="true" />Cancel
        </button>
      </div>
    </Card>
  );
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
