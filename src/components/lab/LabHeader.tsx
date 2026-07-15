import { Activity, Cable, CircuitBoard, RefreshCw, Unplug } from 'lucide-preact';
import type { MiniBusLabState } from '../../hardware/use-mini-bus-lab';

type LabHeaderProps = Pick<
  MiniBusLabState,
  'connection' | 'port' | 'stats' | 'lastScanAt' | 'scan' | 'disconnect'
>;

export function LabHeader({
  connection,
  port,
  stats,
  lastScanAt,
  scan,
  disconnect
}: LabHeaderProps) {
  const connected = connection === 'connected';

  return (
    <header class="lab-header">
      <div class="lab-brand" aria-label="Mini Bus Lab">
        <span class="lab-brand__mark">
          <CircuitBoard size={21} strokeWidth={1.9} />
        </span>
        <span>Mini Bus Lab</span>
      </div>

      <div class="serial-summary" data-state={connection}>
        <span class="status-dot" aria-hidden="true" />
        <span class="serial-summary__state">
          {connected ? 'Serial подключён' : 'Serial отключён'}
        </span>
        <span class="serial-summary__divider" />
        <Cable size={14} />
        <span class="serial-summary__port">{port?.label ?? 'Порт не выбран'}</span>
      </div>

      <div class="lab-header__actions">
        <button class="tool-button" type="button" onClick={scan} disabled={!connected}>
          <RefreshCw size={15} />
          Сканировать
        </button>
        <button
          class="tool-button tool-button--danger"
          type="button"
          onClick={() => void disconnect()}
          disabled={!connected}
        >
          <Unplug size={15} />
          Отключить
        </button>
      </div>

      <div class="traffic-summary" aria-label="Статистика трафика">
        <span class="traffic-summary__label">Трафик</span>
        <TrafficSparkline rx={stats.rxPackets} tx={stats.txPackets} />
        <span class="traffic-counter traffic-counter--rx">RX {formatCompact(stats.rxPackets)}</span>
        <span class="traffic-counter">TX {formatCompact(stats.txPackets)}</span>
        <Activity size={15} />
      </div>

      <div class="last-scan" title="Время последнего сканирования">
        {lastScanAt ? formatClock(lastScanAt) : '—'}
      </div>
    </header>
  );
}

function TrafficSparkline({ rx, tx }: { rx: number; tx: number }) {
  const seed = (rx * 17 + tx * 31) % 13;
  const points = Array.from({ length: 24 }, (_, index) => {
    const x = index * (92 / 23);
    const y = 20 - ((index * 7 + seed * 3 + (index % 4) * 5) % 17);
    return `${x.toFixed(1)},${y}`;
  }).join(' ');

  return (
    <svg class="traffic-sparkline" viewBox="0 0 92 22" role="img" aria-label="График пакетов">
      <polyline points={points} fill="none" stroke="currentColor" stroke-width="1.35" />
    </svg>
  );
}

function formatCompact(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(timestamp);
}
