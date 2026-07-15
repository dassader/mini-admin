import { Clock3, PersonStanding, Zap } from 'lucide-react';
import type { EntityState } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';
import { relativeTime } from './format';

type MotionSensorCardProps = {
  entity: EntityState;
  now: number;
  injectMotion: (id: string) => Promise<void>;
};

export function MotionSensorCard({ entity, now, injectMotion }: MotionSensorCardProps) {
  const active = Boolean(entity.value);
  return (
    <Card title="Motion sensor" icon={<PersonStanding size={21} />} className="entity-card motion-card">
      <p className="entity-id">{entity.id}</p>
      <div className={active ? 'sensor-state sensor-state--active' : 'sensor-state'}>
        <span className="status-dot" />
        <span>Движение</span>
        <strong>{active ? 'Обнаружено' : 'Не обнаружено'}</strong>
      </div>
      <p className="updated-at"><Clock3 size={16} aria-hidden="true" />Обновлено {relativeTime(entity.lastSeenAt, now)}</p>
      <button className="outline-button" type="button" onClick={() => void injectMotion(entity.id)}>
        <Zap size={17} aria-hidden="true" />Fake motion
      </button>
    </Card>
  );
}
