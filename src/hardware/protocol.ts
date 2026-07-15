export const BROADCAST_ADDRESS = 'FF:FF:FF:FF:FF:FF';

export const Group = {
  System: 0x01,
  Logging: 0x02,
  Ota: 0x03,
  ZigBee: 0x05,
  Device: 0x06,
  Light: 0x07,
  BinarySensor: 0x08,
  NumericSensor: 0x09,
  Button: 0x0a
} as const;

export const SystemType = {
  DiscoverRequest: 0x01,
  DiscoverResponse: 0x02,
  PingRequest: 0x03,
  PingResponse: 0x04,
  RebootRequest: 0x05,
  StatusRequest: 0x06,
  StatusResponse: 0x07,
  AdapterListRequest: 0x08,
  AdapterListResponse: 0x09,
  AdapterDisableScheduleRequest: 0x0a,
  AdapterDisableScheduleResponse: 0x0b,
  AdapterDisableCancelRequest: 0x0c,
  AdapterDisableCancelResponse: 0x0d,
  TimerStartRequest: 0x0e,
  TimerStartResponse: 0x0f,
  TimerCancelRequest: 0x10,
  TimerCancelResponse: 0x11,
  TimerEvent: 0x12,
  TimerListRequest: 0x13,
  TimerListResponse: 0x14
} as const;

export const OtaType = {
  BeginRequest: 0x01,
  BeginResponse: 0x02,
  ChunkRequest: 0x03,
  ChunkResponse: 0x04,
  FinishRequest: 0x05,
  FinishResponse: 0x06,
  AbortRequest: 0x07,
  ActiveSlotRequest: 0x08,
  ActiveSlotResponse: 0x09
} as const;

export const OtaResult = {
  Ok: 0x00,
  Busy: 0x01,
  InvalidSize: 0x02,
  InvalidCrc: 0x03,
  InvalidOffset: 0x04,
  WriteFailed: 0x05,
  NotStarted: 0x06,
  VerifyFailed: 0x07,
  InternalError: 0x08
} as const;

export const OTA_CHUNK_DATA_MAX_SIZE = 256;

export const ZigBeeType = {
  StatusRequest: 0x01,
  StatusResponse: 0x02,
  PairingRequest: 0x03,
  PairingStatusEvent: 0x04,
  DeviceListRequest: 0x05,
  DeviceListResponse: 0x06,
  EndpointListRequest: 0x07,
  EndpointListResponse: 0x08,
  ClusterListRequest: 0x09,
  ClusterListResponse: 0x0a,
  DeviceLeaveRequest: 0x0b,
  DeviceLeaveResponse: 0x0c,
  FactoryResetRequest: 0x0d,
  DeviceJoinedEvent: 0x0e,
  DeviceLeftEvent: 0x0f,
  DeviceUnavailableEvent: 0x10,
  AttributeReadRequest: 0x11,
  AttributeReadResponse: 0x12,
  AttributeWriteRequest: 0x13,
  AttributeWriteResponse: 0x14,
  AttributeReport: 0x15,
  CommandRequest: 0x16,
  CommandResponse: 0x17,
  ConfigureReportingRequest: 0x18,
  ConfigureReportingResponse: 0x19,
  BindRequest: 0x1a,
  BindResponse: 0x1b,
  UnbindRequest: 0x1c,
  UnbindResponse: 0x1d,
  RawFrameEvent: 0x1e,
  NodePairingRequest: 0x1f,
  NodePairingResponse: 0x20,
  GroupCommandRequest: 0x21,
  GroupCommandResponse: 0x22
} as const;

export const DeviceType = {
  ListRequest: 0x01,
  State: 0x02
} as const;

export const LightType = {
  StateRequest: 0x01,
  State: 0x02,
  SetRequest: 0x03,
  SetResponse: 0x04
} as const;

export const SensorType = {
  StateRequest: 0x01,
  State: 0x02
} as const;

export const ButtonType = {
  Action: 0x01
} as const;

export type FrameDirection = 'rx' | 'tx';

export type RawFrame = {
  destination: string;
  groupId: number;
  typeId: number;
  payload: Uint8Array;
  bytes: number;
};

export type ParseIssue = {
  type: 'garbage' | 'crc' | 'bad_length';
  bytes: number;
};

export type ParsedFrame = RawFrame & {
  direction: FrameDirection;
  at: number;
  summary: string;
  data: Record<string, unknown>;
};

const CRC16_TABLE = new Uint16Array(256);
for (let index = 0; index < 256; index += 1) {
  let crc = index << 8;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  CRC16_TABLE[index] = crc & 0xffff;
}

export function crc16(data: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of data) {
    const index = ((crc >> 8) ^ byte) & 0xff;
    crc = ((crc << 8) ^ CRC16_TABLE[index]) & 0xffff;
  }
  return crc;
}

const CRC32_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  CRC32_TABLE[index] = crc >>> 0;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function encodeFrame(
  groupId: number,
  typeId: number,
  destination: string,
  payload = new Uint8Array()
): Uint8Array {
  const destinationBytes = addressToBytes(destination);
  const messageLength = 8 + payload.length;
  const frame = new Uint8Array(2 + 2 + messageLength + 2);
  const view = new DataView(frame.buffer);

  frame[0] = 0xa5;
  frame[1] = 0x5a;
  view.setUint16(2, messageLength, true);
  frame.set(destinationBytes, 4);
  frame[10] = groupId;
  frame[11] = typeId;
  frame.set(payload, 12);

  const checksum = crc16(frame.subarray(2, 4 + messageLength));
  view.setUint16(4 + messageLength, checksum, true);
  return frame;
}

export class FrameStreamParser {
  private buffer = new Uint8Array();

  constructor(
    private readonly onFrame: (frame: RawFrame) => void,
    private readonly onIssue: (issue: ParseIssue) => void
  ) {}

  feed(chunk: Uint8Array) {
    const next = new Uint8Array(this.buffer.length + chunk.length);
    next.set(this.buffer);
    next.set(chunk, this.buffer.length);
    this.buffer = next;

    while (this.buffer.length >= 4) {
      if (this.buffer[0] !== 0xa5 || this.buffer[1] !== 0x5a) {
        this.onIssue({ type: 'garbage', bytes: 1 });
        this.buffer = this.buffer.subarray(1);
        continue;
      }

      const messageLength = readUint16(this.buffer, 2);
      if (messageLength < 8) {
        this.onIssue({ type: 'bad_length', bytes: 4 });
        this.buffer = this.buffer.subarray(2);
        continue;
      }

      const totalLength = 2 + 2 + messageLength + 2;
      if (this.buffer.length < totalLength) return;

      const frameBytes = this.buffer.subarray(0, totalLength);
      const expected = crc16(frameBytes.subarray(2, 4 + messageLength));
      const actual = readUint16(frameBytes, 4 + messageLength);
      if (expected !== actual) {
        this.onIssue({ type: 'crc', bytes: totalLength });
        this.buffer = this.buffer.subarray(2);
        continue;
      }

      this.onFrame({
        destination: bytesToAddress(frameBytes.subarray(4, 10)),
        groupId: frameBytes[10],
        typeId: frameBytes[11],
        payload: frameBytes.slice(12, 4 + messageLength),
        bytes: totalLength
      });
      this.buffer = this.buffer.subarray(totalLength);
    }
  }

  reset() {
    this.buffer = new Uint8Array();
  }
}

export function parseFrame(frame: RawFrame, direction: FrameDirection): ParsedFrame {
  let summary = `${groupName(frame.groupId)} · type 0x${hexByte(frame.typeId)}`;
  let data: Record<string, unknown> = {};

  try {
    if (frame.groupId === Group.System && frame.typeId === SystemType.DiscoverResponse) {
      const board = bytesToAddress(frame.payload.subarray(0, 6));
      summary = `Board discovered · ${board}`;
      data = { board };
    } else if (frame.groupId === Group.System && frame.typeId === SystemType.PingRequest) {
      summary = 'Chip ping requested';
    } else if (frame.groupId === Group.System && frame.typeId === SystemType.PingResponse) {
      const board = bytesToAddress(frame.payload.subarray(0, 6));
      summary = `Chip ping response · ${board}`;
      data = { board };
    } else if (frame.groupId === Group.System && frame.typeId === SystemType.RebootRequest) {
      data = {
        delayMs: readUint32(frame.payload, 0),
        reason: frame.payload[4]
      };
      summary = `Chip reboot requested · ${data.delayMs}ms`;
    } else if (frame.groupId === Group.System && frame.typeId === SystemType.StatusResponse) {
      const board = bytesToAddress(frame.payload.subarray(0, 6));
      data = {
        board,
        resetReason: frame.payload[6],
        uptimeMs: readUint32(frame.payload, 7)
      };
      summary = `System status · uptime ${formatDuration(Number(data.uptimeMs))}`;
    } else if (
      frame.groupId === Group.System &&
      frame.typeId === SystemType.AdapterListResponse
    ) {
      const board = bytesToAddress(frame.payload.subarray(0, 6));
      data = {
        board,
        adapterId: frame.payload[6],
        adapterType: frame.payload[7],
        state: frame.payload[8]
      };
      summary = `Bus adapter ${frame.payload[6]} · ${frame.payload[8] ? 'enabled' : 'disabled'}`;
    } else if (
      frame.groupId === Group.System &&
      frame.typeId === SystemType.TimerStartRequest
    ) {
      data = {
        timerId: decodeFixedString(frame.payload, 0, 32),
        timeoutMs: readUint32(frame.payload, 32)
      };
      summary = `Timer ${data.timerId} start · ${data.timeoutMs}ms`;
    } else if (
      frame.groupId === Group.System &&
      [SystemType.TimerStartResponse, SystemType.TimerCancelResponse].some(
        (typeId) => typeId === frame.typeId
      )
    ) {
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        timerId: decodeFixedString(frame.payload, 6, 32),
        result: frame.payload[38],
        generation: readUint32(frame.payload, 39)
      };
      const operation =
        frame.typeId === SystemType.TimerStartResponse ? 'start' : 'cancel';
      summary = `Timer ${data.timerId} ${operation} ${Number(data.result) === 0 ? 'acknowledged' : 'failed'}`;
    } else if (
      frame.groupId === Group.System &&
      frame.typeId === SystemType.TimerCancelRequest
    ) {
      data = { timerId: decodeFixedString(frame.payload, 0, 32) };
      summary = `Timer ${data.timerId} cancel requested`;
    } else if (frame.groupId === Group.System && frame.typeId === SystemType.TimerEvent) {
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        timerId: decodeFixedString(frame.payload, 6, 32),
        reason: frame.payload[38],
        generation: readUint32(frame.payload, 39)
      };
      summary = `Timer ${data.timerId} ${Number(data.reason) === 2 ? 'expired' : 'canceled'}`;
    } else if (
      frame.groupId === Group.System &&
      frame.typeId === SystemType.TimerListRequest
    ) {
      summary = 'Timer inventory requested';
    } else if (
      frame.groupId === Group.System &&
      frame.typeId === SystemType.TimerListResponse
    ) {
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        timerId: decodeFixedString(frame.payload, 6, 32),
        running: Boolean(frame.payload[38]),
        timeoutMs: readUint32(frame.payload, 39),
        remainingMs: readUint32(frame.payload, 43),
        generation: readUint32(frame.payload, 47)
      };
      summary = `Timer ${data.timerId} · ${data.running ? `${data.remainingMs}ms remaining` : 'stopped'}`;
    } else if (frame.groupId === Group.Logging && frame.typeId === 0x01) {
      const board = bytesToAddress(frame.payload.subarray(0, 6));
      const severity = frame.payload[6] ?? 0;
      const message = decodeAscii(frame.payload.subarray(7));
      data = { board, severity, message };
      summary = message;
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.BeginRequest) {
      data = {
        imageSize: readUint32(frame.payload, 0),
        imageCrc32: readUint32(frame.payload, 4)
      };
      summary = `OTA begin requested · ${formatBytes(Number(data.imageSize))}`;
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.BeginResponse) {
      data = decodeOtaProgressResponse(frame.payload);
      summary = `OTA begin ${data.resultName} · slot ${data.targetSlot} offset ${data.nextOffset}`;
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.ChunkRequest) {
      data = {
        offset: readUint32(frame.payload, 0),
        chunkLength: readUint16(frame.payload, 4),
        chunkCrc32: readUint32(frame.payload, 6)
      };
      summary = `OTA chunk · ${data.offset}+${data.chunkLength}`;
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.ChunkResponse) {
      data = decodeOtaProgressResponse(frame.payload);
      summary = `OTA chunk ${data.resultName} · next ${data.nextOffset}`;
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.FinishRequest) {
      data = {
        imageSize: readUint32(frame.payload, 0),
        imageCrc32: readUint32(frame.payload, 4)
      };
      summary = 'OTA finish requested';
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.FinishResponse) {
      const result = frame.payload[0] ?? 0xff;
      data = {
        result,
        resultName: otaResultName(result),
        board: bytesToAddress(frame.payload.subarray(1, 7)),
        targetSlot: frame.payload[7]
      };
      summary = `OTA finish ${data.resultName} · slot ${data.targetSlot}`;
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.AbortRequest) {
      const reason = frame.payload[0] ?? 0xff;
      data = { reason, reasonName: otaResultName(reason) };
      summary = `OTA abort requested · ${data.reasonName}`;
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.ActiveSlotRequest) {
      summary = 'OTA active slot requested';
    } else if (frame.groupId === Group.Ota && frame.typeId === OtaType.ActiveSlotResponse) {
      const result = frame.payload[0] ?? 0xff;
      data = {
        result,
        resultName: otaResultName(result),
        board: bytesToAddress(frame.payload.subarray(1, 7)),
        activeSlot: frame.payload[7]
      };
      summary = `OTA active slot ${data.resultName} · ${data.activeSlot}`;
    } else if (
      frame.groupId === Group.ZigBee &&
      frame.typeId === ZigBeeType.StatusResponse
    ) {
      const board = bytesToAddress(frame.payload.subarray(0, 6));
      data = {
        board,
        ieee: bytesToHex(frame.payload.subarray(6, 14)),
        started: Boolean(frame.payload[14]),
        ready: Boolean(frame.payload[15]),
        pairing: Boolean(frame.payload[16]),
        shortAddress: readUint16(frame.payload, 17),
        panId: readUint16(frame.payload, 19),
        channel: frame.payload[21],
        deviceCount: readUint16(frame.payload, 22)
      };
      summary = `ZigBee ${data.ready ? 'ready' : 'not ready'} · ch ${data.channel} · ${data.deviceCount} devices`;
    } else if (
      frame.groupId === Group.ZigBee &&
      frame.typeId === ZigBeeType.PairingStatusEvent
    ) {
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        status: frame.payload[6],
        seconds: readUint16(frame.payload, 7)
      };
      const statusName =
        Number(data.status) === 1 ? 'started' : Number(data.status) === 2 ? 'finished' : 'error';
      summary = `ZigBee pairing ${statusName} · ${data.seconds}s`;
    } else if (
      frame.groupId === Group.ZigBee &&
      frame.typeId === ZigBeeType.DeviceListResponse
    ) {
      const manufacturerLength = Math.min(frame.payload[17] ?? 0, 32);
      const modelLength = Math.min(frame.payload[50] ?? 0, 32);
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        ieee: bytesToHex(frame.payload.subarray(6, 14)),
        shortAddress: readUint16(frame.payload, 14),
        deviceType: frame.payload[16],
        manufacturer: decodeAscii(frame.payload.subarray(18, 18 + manufacturerLength)),
        model: decodeAscii(frame.payload.subarray(51, 51 + modelLength)),
        lastActiveSeconds: readUint32(frame.payload, 83),
        interview: frame.payload[87],
        last: Boolean(frame.payload[88])
      };
      summary = `${data.manufacturer || 'ZigBee'} ${data.model || 'device'} · ${data.ieee}`;
    } else if (
      frame.groupId === Group.ZigBee &&
      frame.typeId === ZigBeeType.EndpointListResponse
    ) {
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        ieee: bytesToHex(frame.payload.subarray(6, 14)),
        endpoint: frame.payload[14],
        profileId: readUint16(frame.payload, 15),
        deviceId: readUint16(frame.payload, 17),
        deviceVersion: frame.payload[19],
        last: Boolean(frame.payload[20])
      };
      summary = `Endpoint ${data.endpoint} · profile 0x${hexWord(Number(data.profileId))}`;
    } else if (
      frame.groupId === Group.ZigBee &&
      frame.typeId === ZigBeeType.ClusterListResponse
    ) {
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        ieee: bytesToHex(frame.payload.subarray(6, 14)),
        endpoint: frame.payload[14],
        clusterId: readUint16(frame.payload, 15),
        role: frame.payload[17],
        last: Boolean(frame.payload[18])
      };
      summary = `Cluster 0x${hexWord(Number(data.clusterId))} · endpoint ${data.endpoint}`;
    } else if (frame.groupId === Group.ZigBee) {
      const decoded = decodeExtendedZigBeeFrame(frame.typeId, frame.payload);
      if (decoded) {
        data = decoded.data;
        summary = decoded.summary;
      }
    } else if (frame.groupId === Group.Device && frame.typeId === DeviceType.State) {
      const id = readUint64Hex(frame.payload, 7);
      const entityType = frame.payload[15];
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        result: frame.payload[6],
        id,
        entityType,
        subtype: frame.payload[16],
        timestampMs: readUint32(frame.payload, 17)
      };
      summary = `${entityTypeName(entityType)} discovered · ${id}`;
    } else if (frame.groupId === Group.Light && frame.typeId === LightType.State) {
      const id = readUint64Hex(frame.payload, 6);
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        id,
        result: frame.payload[14],
        timestampMs: readUint32(frame.payload, 15),
        capabilities: frame.payload[19],
        warm: frame.payload[20],
        cold: frame.payload[21],
        red: frame.payload[22],
        green: frame.payload[23],
        blue: frame.payload[24]
      };
      summary = `Light ${id} · warm ${data.warm} / cold ${data.cold}`;
    } else if (
      frame.groupId === Group.Light &&
      frame.typeId === LightType.SetResponse
    ) {
      const id = readUint64Hex(frame.payload, 6);
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        id,
        result: frame.payload[14]
      };
      summary = `Light command ${Number(data.result) === 0 ? 'acknowledged' : 'failed'} · ${id}`;
    } else if (
      frame.groupId === Group.BinarySensor &&
      frame.typeId === SensorType.State
    ) {
      const id = readUint64Hex(frame.payload, 6);
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        id,
        result: frame.payload[14],
        sensorClass: frame.payload[15],
        timestampMs: readUint32(frame.payload, 16),
        value: Boolean(frame.payload[20])
      };
      summary = `${Number(data.sensorClass) === 2 ? 'Motion' : 'Binary sensor'} ${data.value ? 'active' : 'clear'} · ${id}`;
    } else if (
      frame.groupId === Group.NumericSensor &&
      frame.typeId === SensorType.State
    ) {
      const id = readUint64Hex(frame.payload, 6);
      const rawValue = readInt32(frame.payload, 20);
      const scale = readInt8(frame.payload, 24);
      const value = rawValue * 10 ** scale;
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        id,
        result: frame.payload[14],
        sensorClass: frame.payload[15],
        timestampMs: readUint32(frame.payload, 16),
        rawValue,
        scale,
        value
      };
      summary = `${Number(data.sensorClass) === 4 ? 'Illuminance' : 'Numeric sensor'} · ${value}${Number(data.sensorClass) === 4 ? ' lux' : ''}`;
    } else if (frame.groupId === Group.Button && frame.typeId === ButtonType.Action) {
      const id = readUint64Hex(frame.payload, 6);
      const action = frame.payload[14];
      data = {
        board: bytesToAddress(frame.payload.subarray(0, 6)),
        id,
        action,
        timestampMs: readUint32(frame.payload, 15),
        sequence: readUint32(frame.payload, 19)
      };
      summary = `Button ${buttonActionName(action)} · ${id}`;
    }
  } catch {
    summary = `${groupName(frame.groupId)} · undecodable type 0x${hexByte(frame.typeId)}`;
    data = { payloadHex: bytesToHex(frame.payload) };
  }

  return {
    ...frame,
    direction,
    at: Date.now(),
    summary,
    data
  };
}

export function encodeUint64(value: string): Uint8Array {
  const output = new Uint8Array(8);
  const view = new DataView(output.buffer);
  const parsed = BigInt(value);
  view.setUint32(0, Number(parsed & 0xffffffffn), true);
  view.setUint32(4, Number((parsed >> 32n) & 0xffffffffn), true);
  return output;
}

export function encodeLightSet(
  id: string,
  channels: { warm?: number; cold?: number; red?: number; green?: number; blue?: number },
  transitionMs = 250
): Uint8Array {
  const payload = new Uint8Array(16);
  const view = new DataView(payload.buffer);
  payload.set(encodeUint64(id), 0);
  payload[8] =
    (channels.warm === undefined ? 0 : 0x01) |
    (channels.cold === undefined ? 0 : 0x02) |
    (channels.red === undefined ? 0 : 0x04) |
    (channels.green === undefined ? 0 : 0x08) |
    (channels.blue === undefined ? 0 : 0x10);
  payload[9] = clampByte(channels.warm ?? 0);
  payload[10] = clampByte(channels.cold ?? 0);
  payload[11] = clampByte(channels.red ?? 0);
  payload[12] = clampByte(channels.green ?? 0);
  payload[13] = clampByte(channels.blue ?? 0);
  view.setUint16(14, Math.max(0, Math.min(65535, transitionMs)), true);
  return payload;
}

export function encodeSyntheticMotion(
  board: string,
  id: string,
  value: boolean,
  timestampMs: number
): Uint8Array {
  const payload = new Uint8Array(21);
  const view = new DataView(payload.buffer);
  payload.set(addressToBytes(board), 0);
  payload.set(encodeUint64(id), 6);
  payload[14] = 0x05;
  payload[15] = 0x02;
  view.setUint32(16, timestampMs >>> 0, true);
  payload[20] = value ? 1 : 0;
  return payload;
}

export function encodeSyntheticButtonAction(
  board: string,
  id: string,
  action: number,
  timestampMs: number,
  sequence: number
): Uint8Array {
  const payload = new Uint8Array(23);
  const view = new DataView(payload.buffer);
  payload.set(addressToBytes(board), 0);
  payload.set(encodeUint64(id), 6);
  payload[14] = clampByte(action);
  view.setUint32(15, timestampMs >>> 0, true);
  view.setUint32(19, sequence >>> 0, true);
  return payload;
}

export function encodeSystemRebootRequest(delayMs = 250, reason = 0): Uint8Array {
  const payload = new Uint8Array(8);
  const view = new DataView(payload.buffer);
  view.setUint32(0, Math.max(0, Math.round(delayMs)) >>> 0, true);
  payload[4] = clampByte(reason);
  return payload;
}

export function encodeTimerStartRequest(timerId: string, timeoutMs: number): Uint8Array {
  const payload = new Uint8Array(36);
  payload.set(encodeFixedString(timerId, 32), 0);
  new DataView(payload.buffer).setUint32(
    32,
    Math.max(0, Math.min(0xffffffff, Math.round(timeoutMs))) >>> 0,
    true
  );
  return payload;
}

export function encodeTimerCancelRequest(timerId: string): Uint8Array {
  return encodeFixedString(timerId, 32);
}

export function encodeOtaBeginRequest(imageSize: number, imageCrc32: number): Uint8Array {
  const payload = new Uint8Array(8);
  const view = new DataView(payload.buffer);
  view.setUint32(0, Math.max(0, Math.round(imageSize)) >>> 0, true);
  view.setUint32(4, imageCrc32 >>> 0, true);
  return payload;
}

export function encodeOtaChunkRequest(offset: number, chunkData: Uint8Array): Uint8Array {
  if (chunkData.length > OTA_CHUNK_DATA_MAX_SIZE) {
    throw new Error(`OTA chunk cannot exceed ${OTA_CHUNK_DATA_MAX_SIZE} bytes.`);
  }
  const payload = new Uint8Array(10 + OTA_CHUNK_DATA_MAX_SIZE);
  const view = new DataView(payload.buffer);
  view.setUint32(0, Math.max(0, Math.round(offset)) >>> 0, true);
  view.setUint16(4, chunkData.length, true);
  view.setUint32(6, crc32(chunkData), true);
  payload.set(chunkData, 10);
  return payload;
}

export function encodeOtaFinishRequest(imageSize: number, imageCrc32: number): Uint8Array {
  return encodeOtaBeginRequest(imageSize, imageCrc32);
}

export function encodeOtaAbortRequest(reason: number): Uint8Array {
  return Uint8Array.of(clampByte(reason));
}

export function encodeZigBeeEndpointRequest(ieee: string): Uint8Array {
  return hexToBytes(ieee);
}

export function encodeZigBeePairingRequest(seconds: number): Uint8Array {
  const payload = new Uint8Array(2);
  new DataView(payload.buffer).setUint16(0, Math.max(0, Math.min(0xffff, seconds)), true);
  return payload;
}

export function encodeZigBeeClusterRequest(ieee: string, endpoint: number): Uint8Array {
  const payload = new Uint8Array(9);
  payload.set(hexToBytes(ieee), 0);
  payload[8] = endpoint;
  return payload;
}

export function addressToBytes(address: string): Uint8Array {
  const bytes = address.split(':').map((part) => Number.parseInt(part, 16));
  if (bytes.length !== 6 || bytes.some((byte) => !Number.isFinite(byte))) {
    throw new Error(`Invalid board address: ${address}`);
  }
  return Uint8Array.from(bytes);
}

export function bytesToAddress(bytes: Uint8Array): string {
  return Array.from(bytes, hexByte).join(':');
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, hexByte).join('');
}

export function hexToBytes(value: string): Uint8Array {
  const normalized = value.replace(/[^0-9a-f]/gi, '');
  if (normalized.length % 2 !== 0) throw new Error(`Invalid hex value: ${value}`);
  const output = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

export function groupName(groupId: number): string {
  return (
    {
      [Group.System]: 'System',
      [Group.Logging]: 'Logging',
      [Group.Ota]: 'OTA',
      [Group.ZigBee]: 'ZigBee',
      [Group.Device]: 'Device',
      [Group.Light]: 'Light',
      [Group.BinarySensor]: 'BinarySensor',
      [Group.NumericSensor]: 'NumericSensor',
      [Group.Button]: 'Button'
    }[groupId] ?? `Group 0x${hexByte(groupId)}`
  );
}

export function entityTypeName(type: number): string {
  return ['Light', 'Binary sensor', 'Numeric sensor', 'Button'][type] ?? `Type ${type}`;
}

export function frameTypeName(groupId: number, typeId: number): string {
  const names: Record<string, string> = {
    [`${Group.System}:${SystemType.DiscoverRequest}`]: 'DISCOVER_REQ',
    [`${Group.System}:${SystemType.DiscoverResponse}`]: 'DISCOVER_RES',
    [`${Group.System}:${SystemType.PingRequest}`]: 'PING_REQ',
    [`${Group.System}:${SystemType.PingResponse}`]: 'PING_RES',
    [`${Group.System}:${SystemType.RebootRequest}`]: 'REBOOT_REQ',
    [`${Group.System}:${SystemType.StatusRequest}`]: 'STATUS_REQ',
    [`${Group.System}:${SystemType.StatusResponse}`]: 'STATUS_RES',
    [`${Group.System}:${SystemType.AdapterListRequest}`]: 'ADAPTERS_REQ',
    [`${Group.System}:${SystemType.AdapterListResponse}`]: 'ADAPTERS_RES',
    [`${Group.System}:${SystemType.TimerStartRequest}`]: 'TIMER_START_REQ',
    [`${Group.System}:${SystemType.TimerStartResponse}`]: 'TIMER_START_RES',
    [`${Group.System}:${SystemType.TimerCancelRequest}`]: 'TIMER_CANCEL_REQ',
    [`${Group.System}:${SystemType.TimerCancelResponse}`]: 'TIMER_CANCEL_RES',
    [`${Group.System}:${SystemType.TimerEvent}`]: 'TIMER_EVENT',
    [`${Group.System}:${SystemType.TimerListRequest}`]: 'TIMER_LIST_REQ',
    [`${Group.System}:${SystemType.TimerListResponse}`]: 'TIMER_LIST_RES',
    [`${Group.Logging}:1`]: 'LOG_MESSAGE',
    [`${Group.Ota}:${OtaType.BeginRequest}`]: 'OTA_BEGIN_REQ',
    [`${Group.Ota}:${OtaType.BeginResponse}`]: 'OTA_BEGIN_RES',
    [`${Group.Ota}:${OtaType.ChunkRequest}`]: 'OTA_CHUNK_REQ',
    [`${Group.Ota}:${OtaType.ChunkResponse}`]: 'OTA_CHUNK_RES',
    [`${Group.Ota}:${OtaType.FinishRequest}`]: 'OTA_FINISH_REQ',
    [`${Group.Ota}:${OtaType.FinishResponse}`]: 'OTA_FINISH_RES',
    [`${Group.Ota}:${OtaType.AbortRequest}`]: 'OTA_ABORT_REQ',
    [`${Group.Ota}:${OtaType.ActiveSlotRequest}`]: 'OTA_ACTIVE_SLOT_REQ',
    [`${Group.Ota}:${OtaType.ActiveSlotResponse}`]: 'OTA_ACTIVE_SLOT_RES',
    [`${Group.ZigBee}:${ZigBeeType.StatusRequest}`]: 'ZB_STATUS_REQ',
    [`${Group.ZigBee}:${ZigBeeType.StatusResponse}`]: 'ZB_STATUS_RES',
    [`${Group.ZigBee}:${ZigBeeType.PairingRequest}`]: 'ZB_PAIRING_REQ',
    [`${Group.ZigBee}:${ZigBeeType.PairingStatusEvent}`]: 'ZB_PAIRING_STATUS',
    [`${Group.ZigBee}:${ZigBeeType.DeviceListRequest}`]: 'ZB_DEVICES_REQ',
    [`${Group.ZigBee}:${ZigBeeType.DeviceListResponse}`]: 'ZB_DEVICES_RES',
    [`${Group.ZigBee}:${ZigBeeType.EndpointListRequest}`]: 'ZB_ENDPOINTS_REQ',
    [`${Group.ZigBee}:${ZigBeeType.EndpointListResponse}`]: 'ZB_ENDPOINTS_RES',
    [`${Group.ZigBee}:${ZigBeeType.ClusterListRequest}`]: 'ZB_CLUSTERS_REQ',
    [`${Group.ZigBee}:${ZigBeeType.ClusterListResponse}`]: 'ZB_CLUSTERS_RES',
    [`${Group.ZigBee}:${ZigBeeType.DeviceLeaveRequest}`]: 'ZB_LEAVE_REQ',
    [`${Group.ZigBee}:${ZigBeeType.DeviceLeaveResponse}`]: 'ZB_LEAVE_RES',
    [`${Group.ZigBee}:${ZigBeeType.FactoryResetRequest}`]: 'ZB_FACTORY_RESET_REQ',
    [`${Group.ZigBee}:${ZigBeeType.DeviceJoinedEvent}`]: 'ZB_DEVICE_JOINED',
    [`${Group.ZigBee}:${ZigBeeType.DeviceLeftEvent}`]: 'ZB_DEVICE_LEFT',
    [`${Group.ZigBee}:${ZigBeeType.DeviceUnavailableEvent}`]: 'ZB_DEVICE_UNAVAILABLE',
    [`${Group.ZigBee}:${ZigBeeType.AttributeReadRequest}`]: 'ZCL_READ_REQ',
    [`${Group.ZigBee}:${ZigBeeType.AttributeReadResponse}`]: 'ZCL_READ_RES',
    [`${Group.ZigBee}:${ZigBeeType.AttributeWriteRequest}`]: 'ZCL_WRITE_REQ',
    [`${Group.ZigBee}:${ZigBeeType.AttributeWriteResponse}`]: 'ZCL_WRITE_RES',
    [`${Group.ZigBee}:${ZigBeeType.AttributeReport}`]: 'ZCL_ATTRIBUTE_REPORT',
    [`${Group.ZigBee}:${ZigBeeType.CommandRequest}`]: 'ZCL_COMMAND_REQ',
    [`${Group.ZigBee}:${ZigBeeType.CommandResponse}`]: 'ZCL_COMMAND_RES',
    [`${Group.ZigBee}:${ZigBeeType.ConfigureReportingRequest}`]: 'ZCL_REPORTING_REQ',
    [`${Group.ZigBee}:${ZigBeeType.ConfigureReportingResponse}`]: 'ZCL_REPORTING_RES',
    [`${Group.ZigBee}:${ZigBeeType.BindRequest}`]: 'ZCL_BIND_REQ',
    [`${Group.ZigBee}:${ZigBeeType.BindResponse}`]: 'ZCL_BIND_RES',
    [`${Group.ZigBee}:${ZigBeeType.UnbindRequest}`]: 'ZCL_UNBIND_REQ',
    [`${Group.ZigBee}:${ZigBeeType.UnbindResponse}`]: 'ZCL_UNBIND_RES',
    [`${Group.ZigBee}:${ZigBeeType.RawFrameEvent}`]: 'ZCL_RAW_FRAME',
    [`${Group.ZigBee}:${ZigBeeType.NodePairingRequest}`]: 'ZB_NODE_PAIRING_REQ',
    [`${Group.ZigBee}:${ZigBeeType.NodePairingResponse}`]: 'ZB_NODE_PAIRING_RES',
    [`${Group.ZigBee}:${ZigBeeType.GroupCommandRequest}`]: 'ZCL_GROUP_COMMAND_REQ',
    [`${Group.ZigBee}:${ZigBeeType.GroupCommandResponse}`]: 'ZCL_GROUP_COMMAND_RES',
    [`${Group.Device}:${DeviceType.ListRequest}`]: 'DEVICE_LIST_REQ',
    [`${Group.Device}:${DeviceType.State}`]: 'DEVICE_STATE',
    [`${Group.Light}:${LightType.StateRequest}`]: 'LIGHT_STATE_REQ',
    [`${Group.Light}:${LightType.State}`]: 'LIGHT_STATE',
    [`${Group.Light}:${LightType.SetRequest}`]: 'LIGHT_SET',
    [`${Group.BinarySensor}:${SensorType.State}`]: 'BINARY_STATE',
    [`${Group.NumericSensor}:${SensorType.State}`]: 'NUMERIC_STATE',
    [`${Group.Button}:${ButtonType.Action}`]: 'BUTTON_ACTION'
  };
  return names[`${groupId}:${typeId}`] ?? `0x${hexByte(groupId)}/0x${hexByte(typeId)}`;
}

function decodeExtendedZigBeeFrame(
  typeId: number,
  payload: Uint8Array
): { summary: string; data: Record<string, unknown> } | undefined {
  const ieee = (offset = 0) => bytesToHex(payload.subarray(offset, offset + 8));
  const board = () => bytesToAddress(payload.subarray(0, 6));
  const hex16 = (value: number) => `0x${hexWord(value)}`;
  const resultName = (result: number) => (result === 0 ? 'OK' : `error ${result}`);

  switch (typeId) {
    case ZigBeeType.StatusRequest:
      return { summary: 'ZigBee status requested', data: {} };
    case ZigBeeType.PairingRequest: {
      const data = { seconds: readUint16(payload, 0) };
      return { summary: `ZigBee pairing requested · ${data.seconds}s`, data };
    }
    case ZigBeeType.DeviceListRequest:
      return { summary: 'ZigBee device inventory requested', data: {} };
    case ZigBeeType.EndpointListRequest: {
      const data = { ieee: ieee() };
      return { summary: `ZigBee endpoints requested · ${data.ieee}`, data };
    }
    case ZigBeeType.ClusterListRequest: {
      const data = { ieee: ieee(), endpoint: payload[8] };
      return { summary: `ZigBee clusters requested · ${data.ieee} ep ${data.endpoint}`, data };
    }
    case ZigBeeType.DeviceLeaveRequest: {
      const data = {
        ieee: ieee(),
        removeChildren: Boolean(payload[8]),
        rejoin: Boolean(payload[9])
      };
      return { summary: `ZigBee leave requested · ${data.ieee}`, data };
    }
    case ZigBeeType.DeviceLeaveResponse: {
      const data = {
        board: board(),
        ieee: ieee(6),
        result: payload[14],
        zigBeeStatus: payload[15]
      };
      return { summary: `ZigBee leave ${resultName(data.result)} · ${data.ieee}`, data };
    }
    case ZigBeeType.FactoryResetRequest:
      return { summary: 'ZigBee factory reset requested', data: {} };
    case ZigBeeType.DeviceJoinedEvent: {
      const data = {
        board: board(),
        ieee: ieee(6),
        shortAddress: readUint16(payload, 14),
        capability: payload[16]
      };
      return { summary: `ZigBee device joined · ${data.ieee}`, data };
    }
    case ZigBeeType.DeviceLeftEvent: {
      const data = {
        board: board(),
        ieee: ieee(6),
        shortAddress: readUint16(payload, 14),
        rejoin: Boolean(payload[16])
      };
      return { summary: `ZigBee device left · ${data.ieee}`, data };
    }
    case ZigBeeType.DeviceUnavailableEvent: {
      const data = {
        board: board(),
        ieee: ieee(6),
        shortAddress: readUint16(payload, 14)
      };
      return { summary: `ZigBee device unavailable · ${data.ieee}`, data };
    }
    case ZigBeeType.AttributeReadRequest: {
      const data = {
        ieee: ieee(),
        endpoint: payload[8],
        clusterId: readUint16(payload, 9),
        attributeId: readUint16(payload, 11),
        role: payload[13],
        manufacturerCode: readUint16(payload, 14)
      };
      return {
        summary: `ZCL read · ${data.ieee} ep ${data.endpoint} ${hex16(data.clusterId)}/${hex16(data.attributeId)}`,
        data
      };
    }
    case ZigBeeType.AttributeReadResponse: {
      const valueLength = payload[22];
      const data = {
        board: board(),
        ieee: ieee(6),
        endpoint: payload[14],
        clusterId: readUint16(payload, 15),
        attributeId: readUint16(payload, 17),
        result: payload[19],
        zigBeeStatus: payload[20],
        attributeType: payload[21],
        valueLength,
        valueHex: bytesToHex(payload.subarray(23, 23 + valueLength))
      };
      return {
        summary: `ZCL read ${resultName(data.result)} · ${data.ieee} ${hex16(data.clusterId)}/${hex16(data.attributeId)}`,
        data
      };
    }
    case ZigBeeType.AttributeWriteRequest: {
      const valueLength = payload[17];
      const data = {
        ieee: ieee(),
        endpoint: payload[8],
        clusterId: readUint16(payload, 9),
        attributeId: readUint16(payload, 11),
        role: payload[13],
        manufacturerCode: readUint16(payload, 14),
        attributeType: payload[16],
        valueLength,
        valueHex: bytesToHex(payload.subarray(18, 18 + valueLength))
      };
      return {
        summary: `ZCL write · ${data.ieee} ${hex16(data.clusterId)}/${hex16(data.attributeId)}`,
        data
      };
    }
    case ZigBeeType.AttributeWriteResponse:
    case ZigBeeType.ConfigureReportingResponse: {
      const data = {
        board: board(),
        ieee: ieee(6),
        endpoint: payload[14],
        clusterId: readUint16(payload, 15),
        attributeId: readUint16(payload, 17),
        result: payload[19],
        zigBeeStatus: payload[20]
      };
      const operation =
        typeId === ZigBeeType.AttributeWriteResponse ? 'write' : 'reporting';
      return {
        summary: `ZCL ${operation} ${resultName(data.result)} · ${data.ieee} ${hex16(data.clusterId)}/${hex16(data.attributeId)}`,
        data
      };
    }
    case ZigBeeType.AttributeReport: {
      const valueLength = payload[26];
      const data = {
        board: board(),
        ieee: ieee(6),
        shortAddress: readUint16(payload, 14),
        endpoint: payload[16],
        clusterId: readUint16(payload, 17),
        frameControl: payload[19],
        sequenceNumber: payload[20],
        manufacturerCode: readUint16(payload, 21),
        attributeId: readUint16(payload, 23),
        attributeType: payload[25],
        valueLength,
        valueHex: bytesToHex(payload.subarray(27, 27 + valueLength))
      };
      return {
        summary: `ZCL report · ${data.ieee} ${hex16(data.clusterId)}/${hex16(data.attributeId)} = ${data.valueHex || '∅'}`,
        data
      };
    }
    case ZigBeeType.CommandRequest: {
      const payloadLength = payload[16];
      const data = {
        ieee: ieee(),
        sourceEndpoint: payload[8],
        destinationEndpoint: payload[9],
        clusterId: readUint16(payload, 10),
        profileId: readUint16(payload, 12),
        direction: payload[14],
        commandId: payload[15],
        payloadLength,
        payloadHex: bytesToHex(payload.subarray(17, 17 + payloadLength))
      };
      return {
        summary: `ZCL command · ${data.ieee} ${hex16(data.clusterId)} cmd 0x${hexByte(data.commandId)}`,
        data
      };
    }
    case ZigBeeType.CommandResponse: {
      const data = {
        board: board(),
        ieee: ieee(6),
        destinationEndpoint: payload[14],
        clusterId: readUint16(payload, 15),
        commandId: payload[17],
        result: payload[18],
        zigBeeStatus: payload[19]
      };
      return {
        summary: `ZCL command ${resultName(data.result)} · ${data.ieee} ${hex16(data.clusterId)} cmd 0x${hexByte(data.commandId)}`,
        data
      };
    }
    case ZigBeeType.ConfigureReportingRequest: {
      const changeLength = payload[22];
      const data = {
        ieee: ieee(),
        endpoint: payload[8],
        clusterId: readUint16(payload, 9),
        attributeId: readUint16(payload, 11),
        reportDirection: payload[13],
        role: payload[14],
        manufacturerCode: readUint16(payload, 15),
        attributeType: payload[17],
        minimumIntervalSeconds: readUint16(payload, 18),
        maximumIntervalSeconds: readUint16(payload, 20),
        reportableChangeHex: bytesToHex(payload.subarray(23, 23 + changeLength)),
        timeoutSeconds: readUint16(payload, 55)
      };
      return {
        summary: `ZCL configure reporting · ${data.ieee} ${hex16(data.clusterId)}/${hex16(data.attributeId)}`,
        data
      };
    }
    case ZigBeeType.BindRequest:
    case ZigBeeType.UnbindRequest: {
      const data = {
        ieee: ieee(),
        sourceEndpoint: payload[8],
        clusterId: readUint16(payload, 9),
        destinationMode: payload[11],
        destinationIeee: ieee(12),
        destinationEndpoint: payload[20],
        groupAddress: readUint16(payload, 21)
      };
      const operation = typeId === ZigBeeType.BindRequest ? 'bind' : 'unbind';
      return {
        summary: `ZCL ${operation} · ${data.ieee} ${hex16(data.clusterId)}`,
        data
      };
    }
    case ZigBeeType.BindResponse:
    case ZigBeeType.UnbindResponse: {
      const data = {
        board: board(),
        ieee: ieee(6),
        sourceEndpoint: payload[14],
        clusterId: readUint16(payload, 15),
        result: payload[17],
        zigBeeStatus: payload[18]
      };
      const operation = typeId === ZigBeeType.BindResponse ? 'bind' : 'unbind';
      return {
        summary: `ZCL ${operation} ${resultName(data.result)} · ${data.ieee} ${hex16(data.clusterId)}`,
        data
      };
    }
    case ZigBeeType.RawFrameEvent: {
      const payloadLength = payload[27];
      const data = {
        board: board(),
        ieee: ieee(6),
        shortAddress: readUint16(payload, 14),
        sourceEndpoint: payload[16],
        destinationEndpoint: payload[17],
        clusterId: readUint16(payload, 18),
        profileId: readUint16(payload, 20),
        frameControl: payload[22],
        sequenceNumber: payload[23],
        manufacturerCode: readUint16(payload, 24),
        commandId: payload[26],
        payloadLength,
        payloadHex: bytesToHex(payload.subarray(28, 28 + payloadLength))
      };
      return {
        summary: `ZCL raw frame · ${data.ieee} ${hex16(data.clusterId)} cmd 0x${hexByte(data.commandId)}`,
        data
      };
    }
    case ZigBeeType.NodePairingRequest: {
      const data = { ieee: ieee(), seconds: readUint16(payload, 8) };
      return { summary: `ZigBee node pairing · ${data.ieee} ${data.seconds}s`, data };
    }
    case ZigBeeType.NodePairingResponse: {
      const data = {
        board: board(),
        ieee: ieee(6),
        seconds: readUint16(payload, 14),
        result: payload[16],
        zigBeeStatus: payload[17]
      };
      return {
        summary: `ZigBee node pairing ${resultName(data.result)} · ${data.ieee}`,
        data
      };
    }
    case ZigBeeType.GroupCommandRequest: {
      const payloadLength = payload[9];
      const data = {
        groupAddress: readUint16(payload, 0),
        sourceEndpoint: payload[2],
        clusterId: readUint16(payload, 3),
        profileId: readUint16(payload, 5),
        direction: payload[7],
        commandId: payload[8],
        payloadLength,
        payloadHex: bytesToHex(payload.subarray(10, 10 + payloadLength))
      };
      return {
        summary: `ZCL group command · group ${hex16(data.groupAddress)} ${hex16(data.clusterId)} cmd 0x${hexByte(data.commandId)}`,
        data
      };
    }
    case ZigBeeType.GroupCommandResponse: {
      const data = {
        board: board(),
        groupAddress: readUint16(payload, 6),
        sourceEndpoint: payload[8],
        clusterId: readUint16(payload, 9),
        commandId: payload[11],
        result: payload[12],
        zigBeeStatus: payload[13]
      };
      return {
        summary: `ZCL group command ${resultName(data.result)} · group ${hex16(data.groupAddress)} ${hex16(data.clusterId)}`,
        data
      };
    }
    default:
      return undefined;
  }
}

function decodeOtaProgressResponse(payload: Uint8Array): Record<string, unknown> {
  const result = payload[0] ?? 0xff;
  return {
    result,
    resultName: otaResultName(result),
    board: bytesToAddress(payload.subarray(1, 7)),
    targetSlot: payload[7],
    nextOffset: readUint32(payload, 8)
  };
}

function encodeFixedString(value: string, length: number): Uint8Array {
  const normalized = value.trim();
  const encoded = new TextEncoder().encode(normalized);
  if (!normalized || encoded.length >= length) {
    throw new Error(`Value must contain 1-${length - 1} UTF-8 bytes.`);
  }
  const output = new Uint8Array(length);
  output.set(encoded);
  return output;
}

function decodeFixedString(bytes: Uint8Array, offset: number, length: number): string {
  return decodeAscii(bytes.subarray(offset, offset + length));
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readInt32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(offset, true);
}

function readInt8(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt8(offset);
}

function readUint64Hex(bytes: Uint8Array, offset: number): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const low = BigInt(view.getUint32(offset, true));
  const high = BigInt(view.getUint32(offset + 4, true));
  return `0x${((high << 32n) | low).toString(16).padStart(16, '0')}`;
}

function decodeAscii(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/g, '').trim();
}

function hexByte(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

function hexWord(value: number): string {
  return value.toString(16).padStart(4, '0').toUpperCase();
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function buttonActionName(action: number): string {
  return ['single click', 'double click', 'triple click', 'hold start', 'hold release'][action] ?? `action ${action}`;
}

export function otaResultName(result: number): string {
  return (
    {
      [OtaResult.Ok]: 'OK',
      [OtaResult.Busy]: 'BUSY',
      [OtaResult.InvalidSize]: 'INVALID_SIZE',
      [OtaResult.InvalidCrc]: 'INVALID_CRC',
      [OtaResult.InvalidOffset]: 'INVALID_OFFSET',
      [OtaResult.WriteFailed]: 'WRITE_FAILED',
      [OtaResult.NotStarted]: 'NOT_STARTED',
      [OtaResult.VerifyFailed]: 'VERIFY_FAILED',
      [OtaResult.InternalError]: 'INTERNAL_ERROR'
    }[result] ?? `error ${result}`
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
