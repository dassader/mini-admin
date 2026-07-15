import { CircuitBoard, Unplug } from 'lucide-react';

type AppHeaderProps = {
  disconnect: () => Promise<void>;
};

export function AppHeader({ disconnect }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__identity">
        <CircuitBoard size={28} strokeWidth={1.8} aria-hidden="true" />
        <strong>Mini Bus</strong>
      </div>
      <div className="app-header__actions">
        <span className="live-label"><span className="status-dot" />Подключено</span>
        <button
          className="header-button"
          type="button"
          aria-label="Отключить устройство"
          onClick={() => void disconnect()}
        >
          <Unplug size={17} aria-hidden="true" />
          <span>Отключить</span>
        </button>
      </div>
    </header>
  );
}
