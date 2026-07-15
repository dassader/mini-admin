import { Download, List, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { bytesToHex, encodeFrame } from '../../hardware/protocol';
import type { BusLogSnapshot, LabEvent } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';

type EventFilter = 'all' | LabEvent['category'];

export function EventsCard({
  events,
  getBusLog
}: {
  events: LabEvent[];
  getBusLog: () => BusLogSnapshot;
}) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      const categoryMatches = filter === 'all' || event.category === filter;
      const queryMatches = !needle || `${event.protocol} ${event.label} ${event.destination}`.toLowerCase().includes(needle);
      return categoryMatches && queryMatches;
    });
  }, [events, filter, query]);

  const download = () => {
    const snapshot = getBusLog();
    if (snapshot.frames.length === 0) return;
    const url = URL.createObjectURL(
      new Blob([serializeBusLog(snapshot)], { type: 'text/plain;charset=utf-8' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mini-bus-raw-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Card title="Events" icon={<List size={21} />} className="events-card">
      <div className="events-toolbar">
        <select value={filter} onChange={(event) => setFilter(event.currentTarget.value as EventFilter)} aria-label="Тип событий">
          <option value="all">Все события</option>
          <option value="system">System</option>
          <option value="network">ZigBee</option>
          <option value="entity">Сущности</option>
          <option value="automation">Автоматизации</option>
          <option value="error">Ошибки</option>
          <option value="raw">Raw</option>
        </select>
        <label className="search-control">
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Фильтр" aria-label="Фильтр событий" />
        </label>
        <button className="outline-button events-download" type="button" onClick={download} disabled={events.length === 0}>
          <Download size={17} aria-hidden="true" />Скачать Bus log
        </button>
        <span className="events-count">{events.length} / 2000 последних</span>
      </div>

      <div className="events-list" role="log" aria-label="Последние события">
        {filtered.length === 0 ? (
          <p className="events-empty">Событий по этому фильтру нет</p>
        ) : (
          filtered.map((event) => (
            <article className="event-row" key={event.key}>
              <time dateTime={new Date(event.at).toISOString()}>{formatTime(event.at)}</time>
              <span className={`direction direction--${event.direction}`}>{event.direction.toUpperCase()}</span>
              <strong>{event.protocol}</strong>
              <p>{event.label}</p>
            </article>
          ))
        )}
      </div>
    </Card>
  );
}

export function serializeBusLog(snapshot: BusLogSnapshot) {
  const header = [
    '# mini Bus raw log',
    `# frames=${snapshot.frames.length}`,
    `# truncated=${snapshot.truncated ? 'yes' : 'no'}`,
    '# timestamp direction destination group type bytes frameHex'
  ];
  const rows = snapshot.frames.map((frame) => {
    const frameBytes = encodeFrame(
      frame.groupId,
      frame.typeId,
      frame.destination,
      new Uint8Array(frame.payload)
    );
    return [
      new Date(frame.at).toISOString(),
      frame.direction.toUpperCase(),
      frame.destination,
      formatHexByte(frame.groupId),
      formatHexByte(frame.typeId),
      `${frame.bytes}B`,
      bytesToHex(frameBytes)
    ].join(' ');
  });
  return [...header, ...rows, ''].join('\n');
}

function formatHexByte(value: number) {
  return `0x${value.toString(16).padStart(2, '0').toUpperCase()}`;
}

function formatTime(timestamp: number) {
  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(timestamp);
  return `${time}.${String(new Date(timestamp).getMilliseconds()).padStart(3, '0')}`;
}
