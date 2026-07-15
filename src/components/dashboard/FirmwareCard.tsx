import { Power, ShieldAlert, UploadCloud } from 'lucide-react';
import { useRef } from 'react';
import type {
  BoardInfo,
  FirmwareUpdateState
} from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';

type FirmwareCardProps = {
  boards: BoardInfo[];
  update: (file?: File) => Promise<void>;
  progress: FirmwareUpdateState;
  clear: () => void;
  activate: (board: string) => Promise<void>;
};

const RUNNING_PHASES: FirmwareUpdateState['phase'][] = [
  'loading',
  'begin',
  'uploading',
  'finishing'
];

export function FirmwareCard({ boards, update, progress, clear, activate }: FirmwareCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = RUNNING_PHASES.includes(progress.phase);
  const targetBoard = progress.board ?? boards[0]?.id;

  const startUpdate = () => {
    if (busy) return;
    const board = boards[0]?.id;
    if (!board) return;
    const confirmed = window.confirm(
      `Точно обновить прошивку устройства ${board}? Во время обновления нельзя закрывать окно.`
    );
    if (!confirmed) return;

    if (window.location.protocol === 'file:') {
      fileInputRef.current?.click();
      return;
    }

    void update();
  };

  const selectFirmware = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    void update(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <Card title="Firmware" icon={<UploadCloud size={21} />} className="firmware-card">
        <dl className="data-list">
          <DataRow label="Target" value={targetBoard ?? '-'} />
          <DataRow label="Status" value={statusText(progress)} />
        </dl>
        <button
          className="outline-button firmware-action"
          type="button"
          disabled={!boards.length || busy}
          onClick={startUpdate}
        >
          <UploadCloud size={17} aria-hidden="true" />Update
        </button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".bin,.img,application/octet-stream"
          onChange={selectFirmware}
        />
      </Card>

      {progress.phase !== 'idle' && (
        <FirmwareDialog progress={progress} busy={busy} clear={clear} activate={activate} />
      )}
    </>
  );
}

function FirmwareDialog({
  progress,
  busy,
  clear,
  activate
}: {
  progress: FirmwareUpdateState;
  busy: boolean;
  clear: () => void;
  activate: (board: string) => Promise<void>;
}) {
  const activateUploadedFirmware = async () => {
    if (!progress.board) return;
    const confirmed = window.confirm(
      `Применить загруженную прошивку на ${progress.board}? Плата перезагрузится.`
    );
    if (!confirmed) return;
    await activate(progress.board);
    clear();
  };

  return (
    <div
      className="firmware-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="firmware-title"
      aria-describedby="firmware-description"
    >
      <div className="firmware-dialog">
        <header className="firmware-dialog__header">
          <div className="firmware-dialog__icon" aria-hidden="true">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h2 id="firmware-title">Firmware update</h2>
            <p id="firmware-description">Не блокируйте телефон и не закрывайте это окно.</p>
          </div>
        </header>
        <div className="firmware-dialog__content">
          <div className="firmware-progress-row">
            <progress max="100" value={progress.progress} />
            <strong>{Math.round(progress.progress)}%</strong>
          </div>
          <p className="firmware-message">{progress.message}</p>
          {progress.totalBytes !== undefined && (
            <span className="firmware-meta">
              {formatBytes(progress.bytesSent ?? 0)} / {formatBytes(progress.totalBytes)}
              {progress.bytesPerSecond !== undefined &&
                ` · ${formatTransferRate(progress.bytesPerSecond)}`}
            </span>
          )}
          {!busy && (
            <div className="firmware-actions">
              {progress.phase === 'done' && progress.board && (
                <button
                  className="outline-button firmware-activate"
                  type="button"
                  onClick={() => void activateUploadedFirmware()}
                >
                  <Power size={17} aria-hidden="true" />
                  Применить прошивку
                </button>
              )}
              <button className="outline-button firmware-close" type="button" onClick={clear}>
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function statusText(progress: FirmwareUpdateState) {
  if (progress.phase === 'idle') return 'Ready';
  if (progress.phase === 'done') return 'Done';
  if (progress.phase === 'error') return 'Error';
  return 'Updating';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatTransferRate(bytesPerSecond: number) {
  return `${formatBytes(Math.max(0, Math.round(bytesPerSecond)))}/s`;
}
