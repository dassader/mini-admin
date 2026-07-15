import { CircuitBoard, LoaderCircle, Usb } from 'lucide-react';
import { WebSerialBus, type SerialConnectionState } from '../../hardware/web-serial';

type ConnectScreenProps = {
  connection: SerialConnectionState;
  error?: string;
  connect: () => Promise<void>;
};

export function ConnectScreen({ connection, error, connect }: ConnectScreenProps) {
  const connecting = connection === 'connecting';
  const unsupported = connection === 'unsupported';
  const support = WebSerialBus.supportInfo();
  const androidWebUsb = support.isAndroid && support.transport === 'webusb';

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
            {error ??
              'USB-доступ недоступен. Откройте HTTPS-версию приложения в Chrome; на Android требуется USB OTG.'}
          </p>
        )}
        {androidWebUsb && !error && (
          <p className="connect-device-hint">
            Подключите плату кабелем данных через USB OTG и подтвердите доступ к USB для Chrome.
          </p>
        )}
      </div>

      <footer className="connect-screen__footer">
        <p>{androidWebUsb ? 'Android Chrome · USB OTG · WebUSB' : 'Chrome · Web Serial'}</p>
      </footer>
    </main>
  );
}
