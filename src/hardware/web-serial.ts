import { serial as webUsbSerial } from 'web-serial-polyfill';
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

type SerialPortFilter = {
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
  requestPort(options?: { filters?: SerialPortFilter[] }): Promise<BrowserSerialPort>;
  getPorts?(): Promise<BrowserSerialPort[]>;
};

type BrowserNavigator = Navigator & {
  serial?: BrowserSerial;
  usb?: unknown;
  userAgentData?: { platform?: string };
};

export type SerialTransportKind = 'web-serial' | 'webusb';

export type SerialRuntimeCapabilities = {
  isSecureContext: boolean;
  isAndroid: boolean;
  hasNativeSerial: boolean;
  hasWebUsb: boolean;
};

export type SerialSupportInfo = SerialRuntimeCapabilities & {
  transport?: SerialTransportKind;
};

const MINI_BUS_USB_FILTERS: SerialPortFilter[] = [
  { usbVendorId: 0x303a, usbProductId: 0x1001 }
];

export type SerialConnectionState =
  | 'unsupported'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type SerialPortDescriptor = {
  label: string;
  transport: SerialTransportKind;
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
    return Boolean(WebSerialBus.supportInfo().transport);
  }

  static supportInfo(): SerialSupportInfo {
    const capabilities = readSerialRuntimeCapabilities();
    return {
      ...capabilities,
      transport: chooseSerialTransport(capabilities)
    };
  }

  async connect() {
    const transport = resolveSerialTransport();
    if (!transport) {
      this.options.onStateChange(
        'unsupported',
        'USB-доступ недоступен. Откройте HTTPS-страницу в Chrome/Edge; на Android нужен Chrome с WebUSB и USB OTG.'
      );
      return;
    }

    this.options.onStateChange('connecting');
    this.closing = false;

    try {
      this.port = await transport.serial.requestPort({ filters: MINI_BUS_USB_FILTERS });
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
        label: formatPortLabel(info, transport.kind),
        transport: transport.kind,
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
      const message = describeConnectionError(error, transport.kind);
      const state = isDevicePickerCancelled(error) ? 'disconnected' : 'error';
      this.options.onStateChange(state, message);
      await this.releasePort();
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

export function chooseSerialTransport(
  capabilities: SerialRuntimeCapabilities
): SerialTransportKind | undefined {
  if (!capabilities.isSecureContext) return undefined;
  if (capabilities.isAndroid && capabilities.hasWebUsb) return 'webusb';
  if (capabilities.hasNativeSerial) return 'web-serial';
  if (capabilities.hasWebUsb) return 'webusb';
  return undefined;
}

function readSerialRuntimeCapabilities(): SerialRuntimeCapabilities {
  const browserNavigator = navigator as BrowserNavigator;
  const platform = browserNavigator.userAgentData?.platform ?? '';
  return {
    isSecureContext: window.isSecureContext,
    isAndroid: /android/i.test(`${platform} ${browserNavigator.userAgent}`),
    hasNativeSerial: Boolean(browserNavigator.serial),
    hasWebUsb: Boolean(browserNavigator.usb)
  };
}

function resolveSerialTransport(): { kind: SerialTransportKind; serial: BrowserSerial } | undefined {
  const browserNavigator = navigator as BrowserNavigator;
  const kind = chooseSerialTransport(readSerialRuntimeCapabilities());
  if (kind === 'web-serial' && browserNavigator.serial) {
    return { kind, serial: browserNavigator.serial };
  }
  if (kind === 'webusb' && browserNavigator.usb) {
    return { kind, serial: webUsbSerial as unknown as BrowserSerial };
  }
  return undefined;
}

function isDevicePickerCancelled(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

function describeConnectionError(error: unknown, transport: SerialTransportKind) {
  if (isDevicePickerCancelled(error)) return 'Выбор USB-устройства отменён.';
  const message = error instanceof Error ? error.message : String(error);
  if (transport === 'webusb' && /Unable to find interface with class/i.test(message)) {
    return 'Плата найдена, но её USB CDC-интерфейс несовместим с WebUSB.';
  }
  if (transport === 'webusb' && /access|claim|permission|security/i.test(message)) {
    return 'Android не дал доступ к USB-плате. Переподключите кабель и подтвердите разрешение Chrome.';
  }
  return message;
}

function formatPortLabel(info: SerialPortInfo, transport: SerialTransportKind): string {
  const transportLabel = transport === 'webusb' ? 'WebUSB' : 'Web Serial';
  if (!info.usbVendorId && !info.usbProductId) return `${transportLabel} · 115200`;
  const vendor = info.usbVendorId?.toString(16).padStart(4, '0').toUpperCase() ?? '----';
  const product = info.usbProductId?.toString(16).padStart(4, '0').toUpperCase() ?? '----';
  return `USB ${vendor}:${product} · ${transportLabel} · 115200`;
}
