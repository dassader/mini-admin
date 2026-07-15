import {
  Boxes,
  CircuitBoard,
  Radio,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  Wifi
} from 'lucide-preact';
import type { MiniBusLabState } from '../../hardware/use-mini-bus-lab';

type HealthStripProps = Pick<
  MiniBusLabState,
  'boards' | 'zigbeeNetwork' | 'health' | 'stats' | 'lastScanAt' | 'scan' | 'autoScan' | 'setAutoScan'
>;

export function HealthStrip({
  boards,
  zigbeeNetwork,
  health,
  stats,
  lastScanAt,
  scan,
  autoScan,
  setAutoScan
}: HealthStripProps) {
  const board = boards[0];
  const metrics = [
    {
      label: 'Координатор',
      value: board?.id ?? '—',
      detail: board ? 'Онлайн' : 'Не найден',
      icon: CircuitBoard,
      tone: board ? 'ok' : 'muted'
    },
    {
      label: 'Канал',
      value: zigbeeNetwork?.channel ?? '—',
      detail: zigbeeNetwork ? '2.405 GHz' : 'ZigBee offline',
      icon: Wifi,
      tone: zigbeeNetwork?.ready ? 'info' : 'muted'
    },
    {
      label: 'PAN ID',
      value: zigbeeNetwork ? `0x${zigbeeNetwork.panId.toString(16).toUpperCase()}` : '—',
      detail: zigbeeNetwork?.pairing ? 'Pairing открыт' : 'Pairing закрыт',
      icon: Radio,
      tone: 'neutral'
    },
    {
      label: 'Устройства',
      value: health.zigbeeDeviceCount,
      detail: `Онлайн: ${zigbeeNetwork?.deviceCount ?? 0}`,
      icon: Boxes,
      tone: 'ok'
    },
    {
      label: 'Сущности',
      value: health.entityCount,
      detail: `Плат: ${health.boardsOnline}`,
      icon: ScanLine,
      tone: 'ok'
    },
    {
      label: 'CRC ошибки',
      value: stats.crcErrors,
      detail: stats.crcErrors === 0 ? '0.00%' : 'Требует внимания',
      icon: ShieldCheck,
      tone: stats.crcErrors === 0 ? 'ok' : 'danger'
    },
    {
      label: 'Parse ошибки',
      value: stats.parseErrors,
      detail: stats.parseErrors === 0 ? 'Поток чистый' : 'Есть мусор',
      icon: TriangleAlert,
      tone: stats.parseErrors === 0 ? 'neutral' : 'danger'
    }
  ];

  return (
    <section class="health-strip" aria-label="Состояние сети">
      <div class="health-strip__metrics">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article class="health-metric" data-tone={tone} key={label}>
            <div class="health-metric__label">
              <Icon size={13} />
              {label}
            </div>
            <strong class="health-metric__value">{value}</strong>
            <span class="health-metric__detail">{detail}</span>
          </article>
        ))}
      </div>

      <div class="scan-control">
        <div>
          <span class="scan-control__label">Последнее сканирование</span>
          <strong>{lastScanAt ? formatClock(lastScanAt) : 'Не запускалось'}</strong>
          <small>{autoScan ? 'Автоопрос каждые 6 сек' : 'Автоопрос выключен'}</small>
        </div>
        <button class="icon-button" type="button" onClick={scan} title="Сканировать сейчас">
          <ScanLine size={17} />
        </button>
        <label class="switch-control" title="Автоматическое сканирование">
          <input
            type="checkbox"
            checked={autoScan}
            onChange={(event) => setAutoScan(event.currentTarget.checked)}
          />
          <span />
        </label>
      </div>
    </section>
  );
}

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(timestamp);
}
