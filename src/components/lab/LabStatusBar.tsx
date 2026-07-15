import { Circle, Disc3 } from 'lucide-preact';
import type { MiniBusLabState } from '../../hardware/use-mini-bus-lab';

type LabStatusBarProps = Pick<MiniBusLabState, 'connection' | 'stats' | 'port'>;

export function LabStatusBar({ connection, stats, port }: LabStatusBarProps) {
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - stats.startedAt) / 1000));
  const rxRate = stats.rxBytes / elapsedSeconds;
  const txRate = stats.txBytes / elapsedSeconds;

  return (
    <footer class="lab-statusbar">
      <div class="recording-state">
        <Disc3 size={14} />
        <span>{connection === 'connected' ? 'Запись' : 'Остановлено'}</span>
        <strong>{formatDuration(elapsedSeconds)}</strong>
      </div>
      <StatusMetric label="RX пакеты" value={stats.rxPackets.toLocaleString('ru-RU')} detail={`${formatRate(stats.rxPackets / elapsedSeconds)}/с`} tone="cyan" />
      <StatusMetric label="TX пакеты" value={stats.txPackets.toLocaleString('ru-RU')} detail={`${formatRate(stats.txPackets / elapsedSeconds)}/с`} tone="cyan" />
      <StatusMetric label="RX байт/с" value={formatBytes(rxRate)} />
      <StatusMetric label="TX байт/с" value={formatBytes(txRate)} />
      <StatusMetric label="CRC ошибки" value={String(stats.crcErrors)} detail={stats.crcErrors === 0 ? '0.00%' : 'check'} tone={stats.crcErrors === 0 ? 'green' : 'red'} />
      <StatusMetric label="Parse ошибки" value={String(stats.parseErrors)} tone={stats.parseErrors === 0 ? 'green' : 'red'} />
      <div class="serial-flags">
        <span>{port?.label ?? 'Serial —'}</span>
        <span>DTR <Circle size={9} fill="currentColor" /></span>
        <span>RTS <Circle size={9} fill="currentColor" /></span>
      </div>
    </footer>
  );
}

function StatusMetric({
  label,
  value,
  detail,
  tone = 'neutral'
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'cyan' | 'green' | 'red';
}) {
  return (
    <div class="status-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${Math.round(value)} B/s`;
  return `${(value / 1024).toFixed(2)} KB/s`;
}

function formatRate(value: number) {
  return value < 10 ? value.toFixed(1) : Math.round(value).toString();
}
