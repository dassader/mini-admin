import { Plus, TimerReset } from 'lucide-react';
import { useState } from 'react';
import type { BoardInfo } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';

type TimerCreateCardProps = {
  boards: BoardInfo[];
  startTimer: (board: string, timerId: string, timeoutMs: number) => Promise<void>;
};

export function TimerCreateCard({ boards, startTimer }: TimerCreateCardProps) {
  const [board, setBoard] = useState('');
  const [timerId, setTimerId] = useState('debug-timer');
  const [seconds, setSeconds] = useState(60);
  const targetBoard = board || boards[0]?.id || '';
  const encodedLength = new TextEncoder().encode(timerId.trim()).length;
  const valid = Boolean(targetBoard && timerId.trim() && encodedLength <= 31 && seconds > 0);

  return (
    <Card title="New timer" icon={<TimerReset size={21} />} className="entity-card timer-create-card">
      <div className="timer-create-form">
        <label><span>Chip</span><select value={targetBoard} onChange={(event) => setBoard(event.currentTarget.value)} disabled={boards.length === 0}>{boards.map((item) => <option value={item.id} key={item.id}>{item.id}</option>)}</select></label>
        <label><span>Timer ID</span><input value={timerId} maxLength={31} onChange={(event) => setTimerId(event.currentTarget.value)} /></label>
        <label><span>Timeout</span><span className="input-with-unit"><input type="number" min="1" max="4294967" value={seconds} onChange={(event) => setSeconds(Math.max(1, Number(event.currentTarget.value) || 1))} /><small>sec</small></span></label>
      </div>
      <button className="outline-button timer-create-submit" type="button" disabled={!valid} onClick={() => void startTimer(targetBoard, timerId, seconds * 1000)}>
        <Plus size={17} aria-hidden="true" />Create & start
      </button>
      {encodedLength > 31 && <p className="field-error">Timer ID должен занимать не больше 31 UTF-8 byte.</p>}
    </Card>
  );
}
