import { ChevronRight, CirclePause, CirclePlay, Filter, Search, Terminal } from 'lucide-preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { LabEvent, MiniBusLabState } from '../../hardware/use-mini-bus-lab';

type EventConsoleProps = Pick<MiniBusLabState, 'events'> & {
  initialMode?: EventMode;
};

type EventMode = 'all' | 'automation' | 'errors' | 'raw';

export function EventConsole({ events, initialMode = 'all' }: EventConsoleProps) {
  const [mode, setMode] = useState<EventMode>(initialMode);
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [frozenEvents, setFrozenEvents] = useState<LabEvent[]>([]);
  const source = paused ? frozenEvents : events;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return source.filter((event) => {
      if (mode === 'automation' && event.category !== 'automation') return false;
      if (mode === 'errors' && event.category !== 'error') return false;
      if (normalized && !`${event.label} ${event.protocol}`.toLowerCase().includes(normalized)) {
        return false;
      }
      return true;
    });
  }, [mode, query, source]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const selected = filtered.find((event) => event.key === selectedKey) ?? filtered[0];

  useEffect(() => setMode(initialMode), [initialMode]);

  const togglePause = () => {
    if (!paused) setFrozenEvents(events);
    setPaused((value) => !value);
  };

  return (
    <section class="workspace-panel event-console" id="events">
      <header class="event-console__toolbar">
        <div class="event-console__title">
          <Terminal size={15} />
          <strong>Журнал событий</strong>
          <span>live</span>
        </div>
        <label class="filter-select">
          <Filter size={13} />
          <select value={mode} onChange={(event) => setMode(event.currentTarget.value as EventMode)}>
            <option value="all">Все типы</option>
            <option value="automation">Автоматизации</option>
            <option value="errors">Только ошибки</option>
            <option value="raw">Raw frames</option>
          </select>
        </label>
        <label class="event-search">
          <Search size={13} />
          <input
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Поиск по протоколу или данным…"
          />
        </label>
        <span class="event-count">Показано: {Math.min(filtered.length, 80)} / {events.length}</span>
        <button class="quiet-button" type="button" onClick={togglePause}>
          {paused ? <CirclePlay size={14} /> : <CirclePause size={14} />}
          {paused ? 'Продолжить' : 'Пауза'}
        </button>
      </header>

      <div class="event-console__body">
        <div class="event-table-wrap">
          <table class="event-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Напр.</th>
                <th>Протокол</th>
                <th>Событие / данные</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 80).map((event) => (
                <tr
                  key={event.key}
                  class={selected?.key === event.key ? 'is-selected' : undefined}
                  data-category={event.category}
                  onClick={() => setSelectedKey(event.key)}
                >
                  <td class="mono event-time">{formatTime(event.at)}</td>
                  <td>
                    <span class={`direction direction--${event.direction}`}>
                      {event.direction.toUpperCase()}
                    </span>
                  </td>
                  <td class="mono event-protocol">{event.protocol}</td>
                  <td>
                    <span class="event-label">{event.label}</span>
                  </td>
                  <td><ChevronRight size={13} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div class="event-empty">Событий для текущего фильтра пока нет.</div>
          )}
        </div>

        <EventDetails event={selected} />
      </div>
    </section>
  );
}

function EventDetails({ event }: { event?: LabEvent }) {
  if (!event) {
    return <aside class="event-details"><span>Выберите событие</span></aside>;
  }

  return (
    <aside class="event-details">
      <header>
        <span class="section-kicker">Детали события</span>
        <strong>{event.protocol}</strong>
      </header>
      <dl>
        <Detail label="Время" value={formatTime(event.at, true)} />
        <Detail label="Направление" value={event.direction === 'rx' ? 'RX → Browser' : 'Browser → TX'} />
        <Detail label="Destination" value={event.destination} mono />
        <Detail label="Group / type" value={`0x${hex(event.groupId)} / 0x${hex(event.typeId)}`} mono />
        <Detail label="Размер" value={`${event.bytes} bytes`} />
        <Detail label="Категория" value={event.category} />
      </dl>
      <div class="event-details__payload">
        <span>Decoded payload</span>
        <pre>{JSON.stringify(event.data, null, 2)}</pre>
      </div>
    </aside>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd class={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  );
}

function formatTime(timestamp: number, milliseconds = false) {
  const date = new Date(timestamp);
  const base = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
  return milliseconds ? `${base}.${String(date.getMilliseconds()).padStart(3, '0')}` : base;
}

function hex(value: number) {
  return value.toString(16).padStart(2, '0').toUpperCase();
}
