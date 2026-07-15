import { useEffect, useState } from 'preact/hooks';
import type { BusEntityId } from '../bus/base-protocol';
import {
  BUTTON_ACTION,
  BUTTON_ACTION_DOUBLE_CLICK,
  BUTTON_ACTION_HOLD_RELEASE,
  BUTTON_ACTION_HOLD_START,
  BUTTON_ACTION_SINGLE_CLICK,
  BUTTON_ACTION_TRIPLE_CLICK,
  BUTTON_GROUP_ID,
  type ButtonActionMessage
} from '../bus/button-protocol';
import type { Bus } from '../bus/bus';
import { DeviceCard } from './DeviceCard';

export type ButtonCardProps = {
  id: string;
  entityId: BusEntityId;
  title: string;
  bus: Bus;
};

const actionTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export function ButtonCard({ id, entityId, title, bus }: ButtonCardProps) {
  const [lastAction, setLastAction] = useState<ButtonActionMessage | null>(null);

  useEffect(() => {
    const unsubscribe = bus.listen((message) => {
      if (message.group !== BUTTON_GROUP_ID || message.type !== BUTTON_ACTION) {
        return;
      }

      const payload = message.payload as Partial<ButtonActionMessage> | undefined;
      if (!payload || payload.id !== entityId) return;

      setLastAction(payload as ButtonActionMessage);
    });

    return unsubscribe;
  }, [bus, entityId]);

  const action = lastAction ? formatAction(lastAction.action) : 'None';
  const actionAt =
    lastAction?.timestampMs === undefined || lastAction.timestampMs === 0
      ? 'Never'
      : actionTimeFormatter.format(new Date(lastAction.timestampMs));

  return (
    <DeviceCard className="button-card">
      <header class="button-card__header">
        <h2>{title}</h2>
        <dl class="sensor-fields">
          <div>
            <dt>Id:</dt>
            <dd>{id}</dd>
          </div>
          <div>
            <dt>Action:</dt>
            <dd>{action}</dd>
          </div>
          <div>
            <dt>Sequence:</dt>
            <dd>{lastAction?.sequence ?? 0}</dd>
          </div>
          <div>
            <dt>Action at:</dt>
            <dd>{actionAt}</dd>
          </div>
        </dl>
      </header>
    </DeviceCard>
  );
}

function formatAction(action: number) {
  switch (action) {
    case BUTTON_ACTION_SINGLE_CLICK:
      return 'Click';
    case BUTTON_ACTION_DOUBLE_CLICK:
      return 'Double';
    case BUTTON_ACTION_TRIPLE_CLICK:
      return 'Triple';
    case BUTTON_ACTION_HOLD_START:
      return 'Press';
    case BUTTON_ACTION_HOLD_RELEASE:
      return 'Release';
    default:
      return `Unknown ${action}`;
  }
}
