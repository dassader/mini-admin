import { Clock3, MousePointerClick } from 'lucide-react';
import { buttonActionName } from '../../hardware/protocol';
import type { EntityState } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';
import { relativeTime } from './format';

const ACTIONS = [
  { id: 0, label: 'Single' },
  { id: 1, label: 'Double' },
  { id: 2, label: 'Triple' },
  { id: 3, label: 'Hold start' },
  { id: 4, label: 'Hold release' }
] as const;

type ButtonCardProps = {
  entity: EntityState;
  now: number;
  injectButtonAction: (id: string, action: number) => Promise<void>;
};

export function ButtonCard({ entity, now, injectButtonAction }: ButtonCardProps) {
  const hasAction = entity.buttonAction !== undefined;

  return (
    <Card title="Button" icon={<MousePointerClick size={21} />} className="entity-card button-card">
      <p className="entity-name">{entity.name}</p>
      <p className="entity-id">{entity.id}</p>
      <div className="button-state">
        <span>Последнее действие</span>
        <strong>{hasAction ? buttonActionName(entity.buttonAction!) : '—'}</strong>
        <small>sequence {entity.sequence ?? 0}</small>
      </div>
      <p className="updated-at">
        <Clock3 size={16} aria-hidden="true" />Обновлено {relativeTime(entity.lastSeenAt, now)}
      </p>
      <div className="button-actions" aria-label="Fake button actions">
        {ACTIONS.map((action) => (
          <button
            className="outline-button"
            type="button"
            key={action.id}
            onClick={() => void injectButtonAction(entity.id, action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
