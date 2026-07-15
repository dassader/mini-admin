import { CircuitBoard, LoaderCircle, Usb } from 'lucide-react';
import type { SerialConnectionState } from '../../hardware/web-serial';

type ConnectScreenProps = {
  connection: SerialConnectionState;
  error?: string;
  connect: () => Promise<void>;
};

export function ConnectScreen({ connection, error, connect }: ConnectScreenProps) {
  const connecting = connection === 'connecting';
  const unsupported = connection === 'unsupported';

  return (
    <main className="connect-screen">
      <header className="connect-brand">
        <CircuitBoard size={42} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <h1>Mini Bus</h1>
          <p>Диагностика устройств и ZigBee</p>
        </div>
      </header>

      <div className="connect-screen__action">
        <button
          className="connect-button"
          type="button"
          onClick={() => void connect()}
          disabled={connecting || unsupported}
          data-testid="connect-device"
        >
          {connecting ? (
            <LoaderCircle className="spin" size={34} aria-hidden="true" />
          ) : (
            <Usb size={36} strokeWidth={1.8} aria-hidden="true" />
          )}
          <span>{connecting ? 'Подключаем…' : 'Подключить устройство'}</span>
        </button>
        {(error || unsupported) && (
          <p className="connect-error" role="alert">
            {error ?? 'Web Serial недоступен. Откройте приложение в Chrome.'}
          </p>
        )}
      </div>

      <footer className="connect-screen__footer">
        <p>Chrome · Web Serial</p>
      </footer>
    </main>
  );
}
