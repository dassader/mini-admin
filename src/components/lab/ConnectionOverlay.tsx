import { Cable, CircleAlert, Monitor, PlugZap, Radio } from 'lucide-preact';
import type { MiniBusLabState } from '../../hardware/use-mini-bus-lab';

type ConnectionOverlayProps = Pick<
  MiniBusLabState,
  'connection' | 'connectionError' | 'connect'
> & {
  open: boolean;
  onClose: () => void;
};

export function ConnectionOverlay({
  connection,
  connectionError,
  connect,
  open,
  onClose
}: ConnectionOverlayProps) {
  if (!open) return null;
  const unsupported = connection === 'unsupported';
  const connecting = connection === 'connecting';

  return (
    <div class="connection-overlay" role="dialog" aria-modal="true" aria-labelledby="connect-title">
      <button class="connection-overlay__backdrop" type="button" aria-label="Закрыть" onClick={onClose} />
      <div class="connection-dialog">
        <div class="connection-dialog__visual">
          <span class="connection-pulse connection-pulse--one" />
          <span class="connection-pulse connection-pulse--two" />
          <span class="connection-device">
            <PlugZap size={31} strokeWidth={1.65} />
          </span>
        </div>

        <div class="connection-dialog__copy">
          <span class="section-kicker">Web Serial · 115200 8N1</span>
          <h1 id="connect-title">Подключите coordinator board</h1>
          <p>
            Chrome покажет системный список serial-устройств. После выбора Mini Bus Lab
            автоматически обнаружит платы, ZigBee nodes и high-level entities.
          </p>
        </div>

        <div class="connection-checks">
          <span><Monitor size={15} /> Chrome / Edge</span>
          <span><Cable size={15} /> USB Serial</span>
          <span><Radio size={15} /> Автосканирование bus</span>
        </div>

        {connectionError && (
          <div class="connection-error">
            <CircleAlert size={16} />
            <span>{connectionError}</span>
          </div>
        )}

        {unsupported && (
          <div class="connection-error">
            <CircleAlert size={16} />
            <span>Web Serial недоступен. Откройте приложение в Chrome через localhost или HTTPS.</span>
          </div>
        )}

        <button
          class="connect-primary"
          type="button"
          onClick={() => void connect().then(onClose).catch(() => undefined)}
          disabled={connecting || unsupported}
        >
          <PlugZap size={17} />
          {connecting ? 'Открываю системный selector…' : 'Выбрать serial-устройство'}
        </button>
        <small class="connection-hint">
          Если устройство занято, сначала отключите transport в mini-service-bus-mcp.
          Browser и MCP не могут одновременно держать один USB port.
        </small>
      </div>
    </div>
  );
}
