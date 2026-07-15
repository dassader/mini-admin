import { Download, RadioTower, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Group, bytesToHex } from '../../hardware/protocol';
import type { LabEvent } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';

export function ZigBeeLogCard({ events }: { events: LabEvent[] }) {
  const [query, setQuery] = useState('');
  const zigbeeEvents = useMemo(() => events.filter((event) => event.groupId === Group.ZigBee), [events]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return zigbeeEvents;
    return zigbeeEvents.filter((event) => `${event.protocol} ${event.label} ${JSON.stringify(event.data)} ${bytesToHex(event.payload)}`.toLowerCase().includes(needle));
  }, [query, zigbeeEvents]);

  const download = () => {
    const json = JSON.stringify(filtered.map((event) => ({
      at: new Date(event.at).toISOString(),
      direction: event.direction,
      protocol: event.protocol,
      destination: event.destination,
      summary: event.summary,
      data: event.data,
      payloadHex: bytesToHex(event.payload)
    })), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zigbee-events-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Card title="ZigBee log" icon={<RadioTower size={21} />} className="zigbee-log-card">
      <div className="zigbee-log-toolbar">
        <label className="search-control"><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Protocol, IEEE, cluster, payload…" aria-label="Фильтр ZigBee событий" /></label>
        <button className="outline-button" type="button" onClick={download} disabled={filtered.length === 0}><Download size={17} aria-hidden="true" />Скачать JSON</button>
        <span>{filtered.length} / {zigbeeEvents.length} frames</span>
      </div>
      <div className="zigbee-log-list" role="log" aria-label="Полный лог ZigBee событий">
        {filtered.length === 0 ? <p className="events-empty">ZigBee событий пока нет</p> : filtered.map((event) => (
          <details className="zigbee-log-row" key={event.key}>
            <summary>
              <time dateTime={new Date(event.at).toISOString()}>{formatTime(event.at)}</time>
              <span className={`direction direction--${event.direction}`}>{event.direction.toUpperCase()}</span>
              <strong>{event.protocol}</strong>
              <span>{event.summary}</span>
            </summary>
            <dl>
              {Object.entries(event.data).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{formatValue(value)}</dd></div>)}
              <div><dt>destination</dt><dd>{event.destination}</dd></div>
              <div><dt>payloadHex</dt><dd>{bytesToHex(event.payload) || '∅'}</dd></div>
            </dl>
          </details>
        ))}
      </div>
    </Card>
  );
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('ru-RU', { hour12: false }) + `.${String(new Date(timestamp).getMilliseconds()).padStart(3, '0')}`;
}

function formatValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
