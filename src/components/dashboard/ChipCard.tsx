import { Cpu, Power, Radio } from 'lucide-react';
import type { BoardInfo } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';

type ChipCardProps = {
  board: BoardInfo;
  pingChip: (board: string) => Promise<void>;
  rebootChip: (board: string, delayMs?: number) => Promise<void>;
};

export function ChipCard({ board, pingChip, rebootChip }: ChipCardProps) {
  const reboot = () => {
    if (!window.confirm(`Перезагрузить chip ${board.id}? Плата уйдёт в reboot через 250 мс.`)) return;
    void rebootChip(board.id, 250);
  };

  return (
    <Card title="Chip" icon={<Cpu size={21} />} className="chip-card">
      <p className="entity-id chip-id">{board.id}</p>
      <dl className="data-list">
        <DataRow label="Uptime" value={formatDuration(board.uptimeMs)} />
        <DataRow label="Reset reason" value={resetReasonName(board.resetReason)} />
        <DataRow label="Bus adapter" value={board.adapterState === undefined ? '—' : board.adapterState ? 'Enabled' : 'Disabled'} />
        <DataRow label="Последний ping" value={board.lastPingLatencyMs === undefined ? '—' : `${board.lastPingLatencyMs} ms`} />
      </dl>
      <div className="chip-actions">
        <button className="outline-button" type="button" onClick={() => void pingChip(board.id)}>
          <Radio size={17} aria-hidden="true" />Ping
        </button>
        <button className="outline-button danger-button" type="button" onClick={reboot}>
          <Power size={17} aria-hidden="true" />Reboot
        </button>
      </div>
    </Card>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function formatDuration(ms?: number) {
  if (ms === undefined) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function resetReasonName(reason?: number) {
  if (reason === undefined) return '—';
  return [
    'Unknown', 'Power on', 'External', 'Software', 'Panic', 'Interrupt WDT',
    'Task WDT', 'WDT', 'Deep sleep', 'Brownout', 'SDIO', 'USB', 'JTAG',
    'eFuse', 'Power glitch', 'CPU lockup'
  ][reason] ?? `Reason ${reason}`;
}
