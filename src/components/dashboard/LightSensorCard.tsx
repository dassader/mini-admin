import { Clock3, Sun } from 'lucide-react';
import type { EntityState } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';
import { relativeTime } from './format';

export function LightSensorCard({ entity, now }: { entity: EntityState; now: number }) {
  const value = typeof entity.value === 'number' ? Math.round(entity.value) : 0;
  return (
    <Card title="Light sensor" icon={<Sun size={21} />} className="entity-card light-sensor-card">
      <p className="entity-id">{entity.id}</p>
      <div className="sensor-reading">
        <span>Освещённость</span>
        <strong>{value} <small>lux</small></strong>
      </div>
      <p className="updated-at"><Clock3 size={16} aria-hidden="true" />Обновлено {relativeTime(entity.lastSeenAt, now)}</p>
    </Card>
  );
}
