import {
  FrameStreamParser,
  encodeFrame,
  parseFrame,
  type ParseIssue,
  type ParsedFrame,
  type RawFrame
} from './protocol';

type SerialOpenOptions = {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
};

type SerialPortInfo = {
  usbVendorId?: number;
  usbProductId?: number;
};

type BrowserSerialPort = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialOpenOptions): Promise<void>;
  close(): Promise<void>;
  getInfo?(): SerialPortInfo;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
};

type BrowserSerial = {
  requestPort(options?: { filters?: Array<Record<string, number>> }): Promise<BrowserSerialPort>;
  getPorts?(): Promise<BrowserSerialPort[]>;
};

declare global {
  interface Navigator {
    serial?: BrowserSerial;
  }
}

export type SerialConnectionState =
  | 'unsupported'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type SerialPortDescriptor = {
  label: string;
  vendorId?: number;
  productId?: number;
};

type WebSerialBusOptions = {
  onFrame: (frame: ParsedFrame) => void;
  onIssue: (issue: ParseIssue) => void;
  onStateChange: (state: SerialConnectionState, error?: string) => void;
  onPortChange: (port: SerialPortDescriptor | null) => void;
};

export class WebSerialBus {
  private port: BrowserSerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoop: Promise<void> | null = null;
  private closing = false;
  private readonly parser: FrameStreamParser;

  constructor(private readonly options: WebSerialBusOptions) {
    this.parser = new FrameStreamParser(
      (frame) => this.handleRawFrame(frame),
      (issue) => this.options.onIssue(issue)
    );
  }

  static supported() {
    return Boolean(navigator.serial && window.isSecureContext);
  }

  async connect() {
    if (!WebSerialBus.supported() || !navigator.serial) {
      this.options.onStateChange(
        'unsupported',
        'Web Serial доступен только в Chrome/Edge в secure context.'
      );
      return;
    }

    this.options.onStateChange('connecting');
    this.closing = false;

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        bufferSize: 65536
      });

      const info = this.port.getInfo?.() ?? {};
      this.options.onPortChange({
        label: formatPortLabel(info),
        vendorId: info.usbVendorId,
        productId: info.usbProductId
      });

      if (!this.port.readable || !this.port.writable) {
        throw new Error('Выбранный serial port не предоставляет read/write streams.');
      }

      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      this.options.onStateChange('connected');
      this.readLoop = this.readForever();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.onStateChange('error', message);
      await this.releasePort();
      throw error;
    }
  }

  async disconnect() {
    if (!this.port) return;
    this.options.onStateChange('disconnecting');
    this.closing = true;
    await this.reader?.cancel().catch(() => undefined);
    await this.readLoop?.catch(() => undefined);
    await this.releasePort();
    this.parser.reset();
    this.options.onPortChange(null);
    this.options.onStateChange('disconnected');
  }

  async send(groupId: number, typeId: number, destination: string, payload?: Uint8Array) {
    if (!this.writer) throw new Error('Serial transport is not connected.');
    const bytes = encodeFrame(
      groupId,
      typeId,
      destination,
      payload ? new Uint8Array(payload) : undefined
    );
    await this.writer.write(bytes);
    this.options.onFrame(
      parseFrame(
        {
          destination,
          groupId,
          typeId,
          payload: payload ?? new Uint8Array(),
          bytes: bytes.length
        },
        'tx'
      )
    );
  }

  private async readForever() {
    if (!this.reader) return;
    try {
      while (!this.closing) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value?.length) this.parser.feed(value);
      }
    } catch (error) {
      if (!this.closing) {
        this.options.onStateChange(
          'error',
          error instanceof Error ? error.message : String(error)
        );
      }
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
    }
  }

  private handleRawFrame(frame: RawFrame) {
    this.options.onFrame(parseFrame(frame, 'rx'));
  }

  private async releasePort() {
    this.reader?.releaseLock();
    this.reader = null;
    this.writer?.releaseLock();
    this.writer = null;
    await this.port?.close().catch(() => undefined);
    this.port = null;
    this.readLoop = null;
  }
}

function formatPortLabel(info: SerialPortInfo): string {
  if (!info.usbVendorId && !info.usbProductId) return 'USB Serial · 115200';
  const vendor = info.usbVendorId?.toString(16).padStart(4, '0').toUpperCase() ?? '----';
  const product = info.usbProductId?.toString(16).padStart(4, '0').toUpperCase() ?? '----';
  return `USB ${vendor}:${product} · 115200`;
}
