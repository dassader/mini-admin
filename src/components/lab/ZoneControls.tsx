import { Lightbulb, PersonStanding, Sparkles, SunMedium, Zap } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import {
  LAB_ZONES,
  type EntityState,
  type MiniBusLabState
} from '../../hardware/use-mini-bus-lab';

type ZoneControlsProps = Pick<
  MiniBusLabState,
  | 'entities'
  | 'groupLight'
  | 'selectedEntityId'
  | 'setSelectedEntityId'
  | 'setLight'
  | 'setGroupPercent'
  | 'injectMotion'
>;

export function ZoneControls({
  entities,
  groupLight,
  selectedEntityId,
  setSelectedEntityId,
  setLight,
  setGroupPercent,
  injectMotion
}: ZoneControlsProps) {
  const groupPercent = Math.round((((groupLight?.warm ?? groupLight?.cold ?? 0) as number) / 255) * 100);

  return (
    <section class="workspace-panel zone-controls" id="entities">
      <header class="section-header zone-controls__header">
        <div>
          <span class="section-kicker">Зоны и управление освещением</span>
          <strong>High-level entities</strong>
        </div>
        <div class="group-control">
          <span>
            <Lightbulb size={14} />
            Группа
          </span>
          <input
            aria-label="Яркость всей группы"
            type="range"
            min="0"
            max="100"
            value={groupPercent}
            onChange={(event) => void setGroupPercent(Number(event.currentTarget.value))}
          />
          <strong>{groupPercent}%</strong>
          <button type="button" onClick={() => void setGroupPercent(0)}>
            Выкл.
          </button>
        </div>
      </header>

      <div class="zone-grid">
        {LAB_ZONES.map((zone) => (
          <ZoneCard
            key={zone.id}
            name={zone.name}
            light={entities.find((entity) => entity.id === zone.lightId)}
            motion={entities.find((entity) => entity.id === zone.motionId)}
            lux={entities.find((entity) => entity.id === zone.luxId)}
            selectedEntityId={selectedEntityId}
            onSelect={setSelectedEntityId}
            onSetLight={setLight}
            onInjectMotion={injectMotion}
          />
        ))}
      </div>
    </section>
  );
}

function ZoneCard({
  name,
  light,
  motion,
  lux,
  selectedEntityId,
  onSelect,
  onSetLight,
  onInjectMotion
}: {
  name: string;
  light?: EntityState;
  motion?: EntityState;
  lux?: EntityState;
  selectedEntityId: string;
  onSelect: (id: string) => void;
  onSetLight: (id: string, warm: number, cold: number, transitionMs?: number) => Promise<void>;
  onInjectMotion: (id: string) => Promise<void>;
}) {
  const [warm, setWarm] = useState(light?.warm ?? 0);
  const [cold, setCold] = useState(light?.cold ?? 0);

  useEffect(() => setWarm(light?.warm ?? 0), [light?.warm]);
  useEffect(() => setCold(light?.cold ?? 0), [light?.cold]);

  const active = Boolean(motion?.value);
  const luxValue = typeof lux?.value === 'number' ? lux.value : undefined;
  const percent = Math.round((Math.max(warm, cold) / 255) * 100);
  const adaptive = active && luxValue !== undefined && luxValue < 100;
  const selected = [light?.id, motion?.id, lux?.id].includes(selectedEntityId);
  const commit = () => light && void onSetLight(light.id, warm, cold, 250);

  return (
    <article class={selected ? 'zone-card is-selected' : 'zone-card'}>
      <header class="zone-card__title">
        <button type="button" onClick={() => light && onSelect(light.id)}>
          <span class="zone-status" />
          <strong>{name}</strong>
        </button>
        <span>{percent}%</span>
      </header>

      <div class="zone-signals">
        <button
          type="button"
          class={active ? 'signal-tile is-active' : 'signal-tile'}
          onClick={() => motion && onSelect(motion.id)}
        >
          <span><PersonStanding size={15} /> Движение</span>
          <strong>{active ? 'Обнаружено' : 'Нет движения'}</strong>
          <small>{motion ? relativeTime(motion.lastSeenAt) : 'Нет данных'}</small>
        </button>
        <button
          type="button"
          class="signal-tile"
          onClick={() => lux && onSelect(lux.id)}
        >
          <span><SunMedium size={15} /> Освещённость</span>
          <strong>{luxValue === undefined ? '—' : `${luxValue} lux`}</strong>
          <small>{lux ? relativeTime(lux.lastSeenAt) : 'Нет данных'}</small>
        </button>
        <div class={adaptive ? 'signal-tile automation-tile is-active' : 'signal-tile automation-tile'}>
          <span><Sparkles size={15} /> Автоматизация</span>
          <strong>{adaptive ? 'Adaptive active' : 'Standby'}</strong>
          <small>{adaptive ? 'motion + low lux' : 'Ожидает условия'}</small>
        </div>
      </div>

      <div class="channel-control">
        <div class="channel-control__label">
          <span>Тёплый канал</span>
          <strong>{Math.round((warm / 255) * 100)}%</strong>
        </div>
        <input
          aria-label={`${name}: тёплый канал`}
          class="range range--warm"
          type="range"
          min="0"
          max="255"
          value={warm}
          onInput={(event) => setWarm(Number(event.currentTarget.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          disabled={!light}
        />
      </div>

      <div class="channel-control">
        <div class="channel-control__label">
          <span>Холодный канал</span>
          <strong>{Math.round((cold / 255) * 100)}%</strong>
        </div>
        <input
          aria-label={`${name}: холодный канал`}
          class="range range--cold"
          type="range"
          min="0"
          max="255"
          value={cold}
          onInput={(event) => setCold(Number(event.currentTarget.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          disabled={!light}
        />
      </div>

      <footer class="zone-card__actions">
        <button
          type="button"
          class="quiet-button"
          onClick={() => {
            setWarm(0);
            setCold(0);
            if (light) void onSetLight(light.id, 0, 0, 250);
          }}
          disabled={!light}
        >
          <Lightbulb size={14} /> Выключить
        </button>
        <button
          type="button"
          class="quiet-button quiet-button--accent"
          onClick={() => motion && void onInjectMotion(motion.id)}
          disabled={!motion}
        >
          <Zap size={14} /> Fake motion
        </button>
      </footer>
    </article>
  );
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return seconds < 2 ? 'только что' : `${seconds} сек назад`;
}
