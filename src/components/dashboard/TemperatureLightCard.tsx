import { Lightbulb, Power, Snowflake, SunMedium } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EntityState } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';

type TemperatureLightCardProps = {
  entity: EntityState;
  setLight: (id: string, warm: number, cold: number, transitionMs?: number) => Promise<void>;
};

export function TemperatureLightCard({ entity, setLight }: TemperatureLightCardProps) {
  const [warm, setWarm] = useState(entity.warm ?? 0);
  const [cold, setCold] = useState(entity.cold ?? 0);
  const lastOn = useRef({ warm: entity.warm || 128, cold: entity.cold ?? 0 });
  const on = warm > 0 || cold > 0;

  useEffect(() => {
    setWarm(entity.warm ?? 0);
    setCold(entity.cold ?? 0);
    if ((entity.warm ?? 0) > 0 || (entity.cold ?? 0) > 0) {
      lastOn.current = { warm: entity.warm ?? 0, cold: entity.cold ?? 0 };
    }
  }, [entity.cold, entity.warm]);

  const commit = () => {
    if (warm > 0 || cold > 0) lastOn.current = { warm, cold };
    void setLight(entity.id, warm, cold, 250);
  };

  const toggle = () => {
    const next = on ? { warm: 0, cold: 0 } : lastOn.current;
    setWarm(next.warm);
    setCold(next.cold);
    void setLight(entity.id, next.warm, next.cold, 250);
  };

  return (
    <Card
      title="Temperature light"
      icon={<Lightbulb size={21} />}
      className="entity-card light-card"
      action={
        <button
          className={on ? 'power-button power-button--on' : 'power-button'}
          type="button"
          onClick={toggle}
          aria-label={on ? 'Выключить свет' : 'Включить свет'}
        >
          <Power size={20} aria-hidden="true" />
        </button>
      }
    >
      <p className="entity-id">{entity.id}</p>
      <ChannelControl
        label="Тёплый канал"
        value={warm}
        icon={<SunMedium size={17} />}
        onChange={setWarm}
        onCommit={commit}
      />
      <ChannelControl
        label="Холодный канал"
        value={cold}
        icon={<Snowflake size={17} />}
        onChange={setCold}
        onCommit={commit}
      />
    </Card>
  );
}

function ChannelControl({
  label,
  value,
  icon,
  onChange,
  onCommit
}: {
  label: string;
  value: number;
  icon: ReactNode;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="channel-row">
      <span className="channel-row__label">{icon}{label}</span>
      <strong>{Math.round((value / 255) * 100)}%</strong>
      <input
        type="range"
        min="0"
        max="255"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </label>
  );
}
