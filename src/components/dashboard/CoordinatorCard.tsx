import { Link, RadioTower, RotateCcw } from 'lucide-react';
import type { ZigBeeNetwork } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';

type CoordinatorCardProps = {
  network?: ZigBeeNetwork;
  pairingEndsAt?: number;
  now: number;
  setPairing: (seconds: number) => Promise<void>;
  resetNetwork: () => Promise<void>;
};

export function CoordinatorCard({
  network,
  pairingEndsAt,
  now,
  setPairing,
  resetNetwork
}: CoordinatorCardProps) {
  const remaining = pairingEndsAt
    ? Math.min(60, Math.max(0, Math.ceil((pairingEndsAt - now) / 1000)))
    : 0;
  const pairing = Boolean(network?.pairing && (remaining > 0 || !pairingEndsAt));

  const reset = () => {
    if (!network?.board) return;
    const confirmed = window.confirm(
      `Сбросить сеть ZigBee на координаторе ${network.board}? Все устройства будут удалены из сети, а координатор может перезагрузиться.`
    );
    if (!confirmed) return;
    void resetNetwork();
  };

  return (
    <Card title="ZigBee coordinator" icon={<RadioTower size={21} />} className="coordinator-card">
      <dl className="data-list">
        <DataRow label="Координатор" value={network?.board ?? '—'} mono />
        <DataRow label="Канал" value={network ? String(network.channel) : '—'} />
        <DataRow label="PAN ID" value={network ? `0x${network.panId.toString(16).padStart(4, '0')}` : '—'} mono />
        <DataRow label="Устройства" value={network ? String(network.deviceCount) : '—'} />
      </dl>
      <button
        className={pairing ? 'outline-button outline-button--active' : 'outline-button'}
        type="button"
        onClick={() => void setPairing(pairing ? 0 : 60)}
        disabled={!network?.ready}
        data-testid="pairing-button"
      >
        <Link size={17} aria-hidden="true" />
        {pairing
          ? `Остановить сопряжение${remaining ? ` · ${remaining} сек` : ''}`
          : 'Включить сопряжение · 60 сек'}
      </button>
      <button
        className="outline-button danger-button"
        type="button"
        onClick={reset}
        disabled={!network?.board}
        data-testid="zigbee-reset-button"
      >
        <RotateCcw size={17} aria-hidden="true" />
        Сбросить сеть
      </button>
    </Card>
  );
}

function DataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  );
}
