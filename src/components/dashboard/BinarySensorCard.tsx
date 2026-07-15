import {
  BellRing,
  CircleDot,
  DoorOpen,
  Droplets,
  Ear,
  Flame,
  PersonStanding,
  ShieldAlert,
  Sun,
  Users,
  Vibrate,
  Zap,
  type LucideIcon
} from 'lucide-react';
import type { EntityState } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';
import { relativeTime } from './format';
import { Clock3 } from 'lucide-react';

type BinarySensorMeta = {
  title: string;
  label: string;
  active: string;
  inactive: string;
  icon: LucideIcon;
};

const SENSOR_META: Record<number, BinarySensorMeta> = {
  0: { title: 'Contact sensor', label: 'Контакт', active: 'Открыт', inactive: 'Закрыт', icon: DoorOpen },
  1: { title: 'Binary button', label: 'Кнопка', active: 'Нажата', inactive: 'Отпущена', icon: CircleDot },
  2: { title: 'Motion sensor', label: 'Движение', active: 'Обнаружено', inactive: 'Не обнаружено', icon: PersonStanding },
  3: { title: 'Occupancy sensor', label: 'Присутствие', active: 'Занято', inactive: 'Свободно', icon: Users },
  4: { title: 'Moisture sensor', label: 'Влага', active: 'Обнаружена', inactive: 'Сухо', icon: Droplets },
  5: { title: 'Smoke sensor', label: 'Дым', active: 'Тревога', inactive: 'Чисто', icon: Flame },
  6: { title: 'Sound sensor', label: 'Звук', active: 'Обнаружен', inactive: 'Тихо', icon: Ear },
  7: { title: 'Vibration sensor', label: 'Вибрация', active: 'Обнаружена', inactive: 'Нет', icon: Vibrate },
  8: { title: 'Tamper sensor', label: 'Вскрытие', active: 'Тревога', inactive: 'Норма', icon: ShieldAlert },
  9: { title: 'Binary light sensor', label: 'Свет', active: 'Светло', inactive: 'Темно', icon: Sun }
};

const FALLBACK_META: BinarySensorMeta = {
  title: 'Binary sensor',
  label: 'Состояние',
  active: 'Активен',
  inactive: 'Неактивен',
  icon: BellRing
};

type BinarySensorCardProps = {
  entity: EntityState;
  now: number;
  injectMotion: (id: string) => Promise<void>;
};

export function BinarySensorCard({ entity, now, injectMotion }: BinarySensorCardProps) {
  const sensorClass = entity.sensorClass ?? entity.subtype;
  const meta = SENSOR_META[sensorClass] ?? FALLBACK_META;
  const Icon = meta.icon;
  const active = Boolean(entity.value);

  return (
    <Card title={meta.title} icon={<Icon size={21} />} className="entity-card binary-sensor-card">
      <p className="entity-name">{entity.name}</p>
      <p className="entity-id">{entity.id}</p>
      <div className={active ? 'sensor-state sensor-state--active' : 'sensor-state'}>
        <span className="status-dot" />
        <span>{meta.label}</span>
        <strong>{active ? meta.active : meta.inactive}</strong>
      </div>
      <p className="updated-at">
        <Clock3 size={16} aria-hidden="true" />Обновлено {relativeTime(entity.lastSeenAt, now)}
      </p>
      {sensorClass === 2 && (
        <button className="outline-button sensor-action" type="button" onClick={() => void injectMotion(entity.id)}>
          <Zap size={17} aria-hidden="true" />Fake motion
        </button>
      )}
    </Card>
  );
}
