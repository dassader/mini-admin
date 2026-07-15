import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BROADCAST_ADDRESS,
  ButtonType,
  DeviceType,
  Group,
  LightType,
  OtaResult,
  OtaType,
  OTA_CHUNK_DATA_MAX_SIZE,
  SensorType,
  SystemType,
  ZigBeeType,
  crc32,
  encodeLightSet,
  encodeOtaAbortRequest,
  encodeOtaBeginRequest,
  encodeOtaChunkRequest,
  encodeOtaFinishRequest,
  encodeSyntheticButtonAction,
  encodeSyntheticMotion,
  encodeSystemRebootRequest,
  encodeTimerCancelRequest,
  encodeTimerStartRequest,
  encodeUint64,
  encodeZigBeeClusterRequest,
  encodeZigBeeEndpointRequest,
  encodeZigBeePairingRequest,
  entityTypeName,
  frameTypeName,
  otaResultName,
  type ParseIssue,
  type ParsedFrame
} from './protocol';
import {
  WebSerialBus,
  type SerialConnectionState,
  type SerialPortDescriptor
} from './web-serial';

export type BoardInfo = {
  id: string;
  lastSeenAt: number;
  uptimeMs?: number;
  resetReason?: number;
  adapterState?: number;
  lastPingAt?: number;
  lastPingLatencyMs?: number;
};

export type ZigBeeNetwork = {
  board: string;
  ieee: string;
  started: boolean;
  ready: boolean;
  pairing: boolean;
  panId: number;
  channel: number;
  deviceCount: number;
  lastSeenAt: number;
};

export type ZigBeeDevice = {
  ieee: string;
  board: string;
  shortAddress: number;
  deviceType: number;
  manufacturer: string;
  model: string;
  lastActiveSeconds: number;
  interview: number;
  lastSeenAt: number;
  endpoints: number[];
  clusters: Array<{ endpoint: number; clusterId: number; role: number }>;
};

export type EntityState = {
  id: string;
  board: string;
  type: number;
  subtype: number;
  name: string;
  zone?: string;
  timestampMs: number;
  lastSeenAt: number;
  result: number;
  warm?: number;
  cold?: number;
  red?: number;
  green?: number;
  blue?: number;
  capabilities?: number;
  value?: boolean | number;
  sensorClass?: number;
  buttonAction?: number;
  sequence?: number;
};

export type TimerState = {
  key: string;
  id: string;
  board: string;
  running: boolean;
  timeoutMs: number;
  remainingMs: number;
  generation: number;
  snapshotAt: number;
  lastSeenAt: number;
  result?: number;
  reason?: number;
};

export type LabEvent = ParsedFrame & {
  key: string;
  label: string;
  protocol: string;
  category: 'system' | 'network' | 'entity' | 'automation' | 'error' | 'raw';
};

export type BusLogFrame = Pick<
  ParsedFrame,
  'at' | 'direction' | 'destination' | 'groupId' | 'typeId' | 'payload' | 'bytes'
>;

export type BusLogSnapshot = {
  frames: BusLogFrame[];
  truncated: boolean;
};

export type TrafficStats = {
  rxPackets: number;
  txPackets: number;
  rxBytes: number;
  txBytes: number;
  crcErrors: number;
  parseErrors: number;
  startedAt: number;
};

export type FirmwareUpdatePhase =
  | 'idle'
  | 'loading'
  | 'begin'
  | 'uploading'
  | 'finishing'
  | 'done'
  | 'error';

export type FirmwareUpdateState = {
  phase: FirmwareUpdatePhase;
  progress: number;
  message: string;
  board?: string;
  fileName?: string;
  bytesSent?: number;
  totalBytes?: number;
  bytesPerSecond?: number;
  targetSlot?: number;
};

type OtaResponseWaiter = {
  board: string;
  typeId: number;
  timeoutId: number;
  resolve: (frame: ParsedFrame) => void;
  reject: (error: Error) => void;
};

export const KNOWN_ENTITY_NAMES: Record<string, { name: string; zone?: string }> = {
  '0xa4c138345da05fff': { name: 'Kitchen Left Light', zone: 'Kitchen Left' },
  '0xa4c1388a6c9e9ee4': { name: 'Kitchen Right Light', zone: 'Kitchen Right' },
  '0xa4c138f446e532ac': { name: 'Entrance Light', zone: 'Entrance' },
  '0x06279c245ca1e601': { name: 'Ambient Light Group', zone: 'All zones' },
  '0x00158d0009e07cc7': { name: 'Master Button' },
  '0x67b59ce03232051c': { name: 'Kitchen Left Motion', zone: 'Kitchen Left' },
  '0x67b59fe032320a35': { name: 'Kitchen Left Illuminance', zone: 'Kitchen Left' },
  '0x4015e7d8bc88a038': { name: 'Kitchen Right Motion', zone: 'Kitchen Right' },
  '0x4015ead8bc88a551': { name: 'Kitchen Right Illuminance', zone: 'Kitchen Right' },
  '0x4ebc10f58024d948': { name: 'Entrance Motion', zone: 'Entrance' },
  '0x4ebc13f58024de61': { name: 'Entrance Illuminance', zone: 'Entrance' }
};

export const LAB_ZONES = [
  {
    id: 'kitchen-left',
    name: 'Kitchen Left',
    lightId: '0xa4c138345da05fff',
    motionId: '0x67b59ce03232051c',
    luxId: '0x67b59fe032320a35',
    zigbeeIeee: 'ff5fa05d3438c1a4'
  },
  {
    id: 'kitchen-right',
    name: 'Kitchen Right',
    lightId: '0xa4c1388a6c9e9ee4',
    motionId: '0x4015e7d8bc88a038',
    luxId: '0x4015ead8bc88a551',
    zigbeeIeee: 'e49e9e6c8a38c1a4'
  },
  {
    id: 'entrance',
    name: 'Entrance',
    lightId: '0xa4c138f446e532ac',
    motionId: '0x4ebc10f58024d948',
    luxId: '0x4ebc13f58024de61',
    zigbeeIeee: 'ac32e546f438c1a4'
  }
] as const;

const GROUP_LIGHT_ID = '0x06279c245ca1e601';
const SCAN_INTERVAL_MS = 6000;
const EVENT_LIMIT = 2000;
const BUS_LOG_LIMIT = 20000;
const BUS_LOG_TRIM_SIZE = 2000;
const OTA_RESPONSE_TIMEOUT_MS = 30000;
const OTA_REBOOT_DELAY_MS = 500;
const OTA_REBOOT_REASON = 0x03;
const FIRMWARE_URL_CANDIDATES = [
  './firmware.bin',
  './firmware.img',
  './app.bin'
] as const;

export function useMiniBusLab() {
  const [connection, setConnection] = useState<SerialConnectionState>(() =>
    WebSerialBus.supported() ? 'disconnected' : 'unsupported'
  );
  const [connectionError, setConnectionError] = useState<string>();
  const [port, setPort] = useState<SerialPortDescriptor | null>(null);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [zigbeeNetwork, setZigbeeNetwork] = useState<ZigBeeNetwork>();
  const [zigbeeDevices, setZigbeeDevices] = useState<ZigBeeDevice[]>([]);
  const [entities, setEntities] = useState<EntityState[]>([]);
  const [timers, setTimers] = useState<TimerState[]>([]);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [stats, setStats] = useState<TrafficStats>(() => emptyStats());
  const [lastScanAt, setLastScanAt] = useState<number>();
  const [selectedEntityId, setSelectedEntityId] = useState<string>(LAB_ZONES[0].motionId);
  const [autoScan, setAutoScan] = useState(true);
  const [pairingEndsAt, setPairingEndsAt] = useState<number>();
  const [firmwareUpdate, setFirmwareUpdate] = useState<FirmwareUpdateState>(() => ({
    phase: 'idle',
    progress: 0,
    message: ''
  }));

  const boardsRef = useRef(new Map<string, BoardInfo>());
  const entitiesRef = useRef(new Map<string, EntityState>());
  const timersRef = useRef(new Map<string, TimerState>());
  const zigbeeDevicesRef = useRef(new Map<string, ZigBeeDevice>());
  const busRef = useRef<WebSerialBus | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const statsRef = useRef(stats);
  const otaWaiters = useRef(new Set<OtaResponseWaiter>());
  const firmwareInFlight = useRef(false);
  const eventCounter = useRef(0);
  const busLogRef = useRef<BusLogFrame[]>([]);
  const busLogTruncatedRef = useRef(false);
  const requestedEntityState = useRef(new Set<string>());
  const requestedZigBeeDevice = useRef(new Set<string>());
  const requestedZigBeeClusters = useRef(new Set<string>());
  const pingRequestedAt = useRef(new Map<string, number>());
  const buttonSequences = useRef(new Map<string, number>());

  const appendEvent = useCallback((frame: ParsedFrame) => {
    const busLog = busLogRef.current;
    busLog.push({
      at: frame.at,
      direction: frame.direction,
      destination: frame.destination,
      groupId: frame.groupId,
      typeId: frame.typeId,
      payload: new Uint8Array(frame.payload),
      bytes: frame.bytes
    });
    if (busLog.length > BUS_LOG_LIMIT) {
      busLog.splice(0, BUS_LOG_TRIM_SIZE);
      busLogTruncatedRef.current = true;
    }

    const isOtaChunk =
      frame.groupId === Group.Ota &&
      (frame.typeId === OtaType.ChunkRequest || frame.typeId === OtaType.ChunkResponse);
    eventCounter.current += 1;
    const id = typeof frame.data.id === 'string' ? frame.data.id : undefined;
    const known = id ? KNOWN_ENTITY_NAMES[id] : undefined;
    const label = known ? `${known.name} · ${frame.summary}` : frame.summary;
    const category = categorizeFrame(frame);
    const event: LabEvent = {
      ...frame,
      key: `${frame.at}-${eventCounter.current}`,
      label,
      protocol: frameTypeName(frame.groupId, frame.typeId),
      category
    };
    const currentStats = statsRef.current;
    const nextStats = {
      ...currentStats,
      rxPackets: currentStats.rxPackets + (frame.direction === 'rx' ? 1 : 0),
      txPackets: currentStats.txPackets + (frame.direction === 'tx' ? 1 : 0),
      rxBytes: currentStats.rxBytes + (frame.direction === 'rx' ? frame.bytes : 0),
      txBytes: currentStats.txBytes + (frame.direction === 'tx' ? frame.bytes : 0)
    };
    statsRef.current = nextStats;

    if (firmwareInFlight.current && isOtaChunk) return;
    setEvents((current) => [event, ...current].slice(0, EVENT_LIMIT));
    setStats(nextStats);
  }, []);

  const getBusLog = useCallback(
    (): BusLogSnapshot => ({
      frames: busLogRef.current.slice(),
      truncated: busLogTruncatedRef.current
    }),
    []
  );

  const queueSend = useCallback(
    (
      groupId: number,
      typeId: number,
      destination: string,
      payload?: Uint8Array
    ): Promise<void> => {
      const next = queueRef.current
        .then(async () => {
          const bus = busRef.current;
          if (!bus) throw new Error('Serial transport is not connected.');
          await bus.send(groupId, typeId, destination, payload);
          await delay(18);
        })
        .catch((error) => {
          setConnectionError(error instanceof Error ? error.message : String(error));
        });
      queueRef.current = next;
      return next;
    },
    []
  );

  const requestZigBeeDetails = useCallback(
    (board: string, ieee: string) => {
      if (requestedZigBeeDevice.current.has(ieee)) return;
      requestedZigBeeDevice.current.add(ieee);
      void queueSend(
        Group.ZigBee,
        ZigBeeType.EndpointListRequest,
        board,
        encodeZigBeeEndpointRequest(ieee)
      );
    },
    [queueSend]
  );

  const requestClusters = useCallback(
    (board: string, ieee: string, endpoint: number) => {
      const key = `${ieee}:${endpoint}`;
      if (requestedZigBeeClusters.current.has(key)) return;
      requestedZigBeeClusters.current.add(key);
      void queueSend(
        Group.ZigBee,
        ZigBeeType.ClusterListRequest,
        board,
        encodeZigBeeClusterRequest(ieee, endpoint)
      );
    },
    [queueSend]
  );

  const requestEntity = useCallback(
    (entity: EntityState, force = false) => {
      if (!force && requestedEntityState.current.has(entity.id)) return;
      requestedEntityState.current.add(entity.id);
      if (entity.type === 0) {
        void queueSend(
          Group.Light,
          LightType.StateRequest,
          entity.board,
          encodeUint64(entity.id)
        );
      } else if (entity.type === 1) {
        void queueSend(
          Group.BinarySensor,
          SensorType.StateRequest,
          entity.board,
          encodeUint64(entity.id)
        );
      } else if (entity.type === 2) {
        void queueSend(
          Group.NumericSensor,
          SensorType.StateRequest,
          entity.board,
          encodeUint64(entity.id)
        );
      }
    },
    [queueSend]
  );

  const refreshBoard = useCallback(
    (board: string) => {
      void queueSend(Group.System, SystemType.StatusRequest, board);
      void queueSend(Group.System, SystemType.AdapterListRequest, board);
      void queueSend(Group.ZigBee, ZigBeeType.StatusRequest, board);
      void queueSend(Group.Device, DeviceType.ListRequest, board);
      void queueSend(Group.ZigBee, ZigBeeType.DeviceListRequest, board);
      void queueSend(Group.System, SystemType.TimerListRequest, board);
    },
    [queueSend]
  );

  const waitForOtaResponse = useCallback(
    (board: string, typeId: number, timeoutMs = OTA_RESPONSE_TIMEOUT_MS) =>
      new Promise<ParsedFrame>((resolve, reject) => {
        const waiter: OtaResponseWaiter = {
          board: board.toUpperCase(),
          typeId,
          timeoutId: window.setTimeout(() => {
            otaWaiters.current.delete(waiter);
            reject(
              new Error(
                `Timeout waiting for ${frameTypeName(Group.Ota, typeId)} from ${board}.`
              )
            );
          }, timeoutMs),
          resolve,
          reject
        };
        otaWaiters.current.add(waiter);
      }),
    []
  );

  const rejectOtaWaiters = useCallback((message: string) => {
    for (const waiter of otaWaiters.current) {
      window.clearTimeout(waiter.timeoutId);
      waiter.reject(new Error(message));
    }
    otaWaiters.current.clear();
  }, []);

  const resolveOtaWaiters = useCallback((frame: ParsedFrame) => {
    if (
      frame.direction !== 'rx' ||
      frame.groupId !== Group.Ota ||
      typeof frame.data.board !== 'string'
    ) {
      return;
    }

    const board = frame.data.board.toUpperCase();
    for (const waiter of [...otaWaiters.current]) {
      if (waiter.typeId !== frame.typeId || waiter.board !== board) continue;
      window.clearTimeout(waiter.timeoutId);
      otaWaiters.current.delete(waiter);
      waiter.resolve(frame);
    }
  }, []);

  const handleFrame = useCallback(
    (frame: ParsedFrame) => {
      appendEvent(frame);
      resolveOtaWaiters(frame);
      const { data } = frame;
      const now = frame.at;

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.System &&
        frame.typeId === SystemType.DiscoverResponse &&
        typeof data.board === 'string'
      ) {
        const previous = boardsRef.current.get(data.board);
        const board = { ...previous, id: data.board, lastSeenAt: now };
        boardsRef.current.set(board.id, board);
        setBoards([...boardsRef.current.values()]);
        if (!previous) refreshBoard(board.id);
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.System &&
        frame.typeId === SystemType.StatusResponse &&
        typeof data.board === 'string'
      ) {
        const previous = boardsRef.current.get(data.board);
        const board: BoardInfo = {
          ...previous,
          id: data.board,
          lastSeenAt: now,
          uptimeMs: numberOrUndefined(data.uptimeMs),
          resetReason: numberOrUndefined(data.resetReason),
          adapterState: previous?.adapterState
        };
        boardsRef.current.set(board.id, board);
        setBoards([...boardsRef.current.values()]);
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.System &&
        frame.typeId === SystemType.AdapterListResponse &&
        typeof data.board === 'string'
      ) {
        const previous = boardsRef.current.get(data.board);
        const board: BoardInfo = {
          ...previous,
          id: data.board,
          lastSeenAt: now,
          uptimeMs: previous?.uptimeMs,
          resetReason: previous?.resetReason,
          adapterState: numberOrUndefined(data.state)
        };
        boardsRef.current.set(board.id, board);
        setBoards([...boardsRef.current.values()]);
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.System &&
        frame.typeId === SystemType.PingResponse &&
        typeof data.board === 'string'
      ) {
        const previous = boardsRef.current.get(data.board);
        const requestedAt = pingRequestedAt.current.get(data.board);
        const board: BoardInfo = {
          ...previous,
          id: data.board,
          lastSeenAt: now,
          lastPingAt: now,
          lastPingLatencyMs: requestedAt ? Math.max(0, now - requestedAt) : undefined
        };
        pingRequestedAt.current.delete(data.board);
        boardsRef.current.set(board.id, board);
        setBoards([...boardsRef.current.values()]);
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.System &&
        frame.typeId === SystemType.TimerListResponse &&
        typeof data.board === 'string' &&
        typeof data.timerId === 'string'
      ) {
        const key = timerKey(data.board, data.timerId);
        const timer: TimerState = {
          key,
          id: data.timerId,
          board: data.board,
          running: Boolean(data.running),
          timeoutMs: Number(data.timeoutMs ?? 0),
          remainingMs: Number(data.remainingMs ?? 0),
          generation: Number(data.generation ?? 0),
          snapshotAt: now,
          lastSeenAt: now,
          result: 0
        };
        timersRef.current.set(key, timer);
        setTimers(sortTimers([...timersRef.current.values()]));
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.System &&
        [SystemType.TimerStartResponse, SystemType.TimerCancelResponse].some(
          (typeId) => typeId === frame.typeId
        ) &&
        typeof data.board === 'string' &&
        typeof data.timerId === 'string'
      ) {
        const key = timerKey(data.board, data.timerId);
        const previous = timersRef.current.get(key);
        const result = Number(data.result ?? -1);
        const starting = frame.typeId === SystemType.TimerStartResponse;
        const timer: TimerState = {
          key,
          id: data.timerId,
          board: data.board,
          running: result === 0 && starting,
          timeoutMs: previous?.timeoutMs ?? 0,
          remainingMs: result === 0 && starting ? previous?.timeoutMs ?? 0 : 0,
          generation: Number(data.generation ?? previous?.generation ?? 0),
          snapshotAt: now,
          lastSeenAt: now,
          result,
          reason: starting ? undefined : 1
        };
        timersRef.current.set(key, timer);
        setTimers(sortTimers([...timersRef.current.values()]));
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.System &&
        frame.typeId === SystemType.TimerEvent &&
        typeof data.board === 'string' &&
        typeof data.timerId === 'string'
      ) {
        const key = timerKey(data.board, data.timerId);
        const previous = timersRef.current.get(key);
        const timer: TimerState = {
          key,
          id: data.timerId,
          board: data.board,
          running: false,
          timeoutMs: previous?.timeoutMs ?? 0,
          remainingMs: 0,
          generation: Number(data.generation ?? previous?.generation ?? 0),
          snapshotAt: now,
          lastSeenAt: now,
          result: 0,
          reason: Number(data.reason ?? 0)
        };
        timersRef.current.set(key, timer);
        setTimers(sortTimers([...timersRef.current.values()]));
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.ZigBee &&
        frame.typeId === ZigBeeType.StatusResponse &&
        typeof data.board === 'string'
      ) {
        setZigbeeNetwork({
          board: data.board,
          ieee: String(data.ieee ?? ''),
          started: Boolean(data.started),
          ready: Boolean(data.ready),
          pairing: Boolean(data.pairing),
          panId: Number(data.panId ?? 0),
          channel: Number(data.channel ?? 0),
          deviceCount: Number(data.deviceCount ?? 0),
          lastSeenAt: now
        });
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.ZigBee &&
        frame.typeId === ZigBeeType.PairingStatusEvent &&
        typeof data.board === 'string'
      ) {
        const seconds = Number(data.seconds ?? 0);
        const pairing = Number(data.status ?? 0) === 1 && seconds > 0;
        setPairingEndsAt(pairing ? Date.now() + seconds * 1000 : undefined);
        setZigbeeNetwork((current) =>
          current ? { ...current, pairing, lastSeenAt: now } : current
        );
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.ZigBee &&
        frame.typeId === ZigBeeType.DeviceListResponse &&
        typeof data.ieee === 'string' &&
        typeof data.board === 'string'
      ) {
        const previous = zigbeeDevicesRef.current.get(data.ieee);
        const device: ZigBeeDevice = {
          ieee: data.ieee,
          board: data.board,
          shortAddress: Number(data.shortAddress ?? 0),
          deviceType: Number(data.deviceType ?? 3),
          manufacturer: String(data.manufacturer ?? ''),
          model: String(data.model ?? ''),
          lastActiveSeconds: Number(data.lastActiveSeconds ?? 0),
          interview: Number(data.interview ?? 0),
          lastSeenAt: now,
          endpoints: previous?.endpoints ?? [],
          clusters: previous?.clusters ?? []
        };
        zigbeeDevicesRef.current.set(device.ieee, device);
        setZigbeeDevices([...zigbeeDevicesRef.current.values()]);
        requestZigBeeDetails(device.board, device.ieee);
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.ZigBee &&
        frame.typeId === ZigBeeType.EndpointListResponse &&
        typeof data.ieee === 'string' &&
        typeof data.board === 'string'
      ) {
        const endpoint = Number(data.endpoint ?? 0);
        const previous = zigbeeDevicesRef.current.get(data.ieee);
        if (previous) {
          const endpoints = [...new Set([...previous.endpoints, endpoint])].sort(
            (left, right) => left - right
          );
          zigbeeDevicesRef.current.set(previous.ieee, { ...previous, endpoints });
          setZigbeeDevices([...zigbeeDevicesRef.current.values()]);
          requestClusters(data.board, data.ieee, endpoint);
        }
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.ZigBee &&
        frame.typeId === ZigBeeType.ClusterListResponse &&
        typeof data.ieee === 'string'
      ) {
        const previous = zigbeeDevicesRef.current.get(data.ieee);
        if (previous) {
          const cluster = {
            endpoint: Number(data.endpoint ?? 0),
            clusterId: Number(data.clusterId ?? 0),
            role: Number(data.role ?? 0)
          };
          const clusters = previous.clusters.some(
            (item) =>
              item.endpoint === cluster.endpoint &&
              item.clusterId === cluster.clusterId &&
              item.role === cluster.role
          )
            ? previous.clusters
            : [...previous.clusters, cluster];
          zigbeeDevicesRef.current.set(previous.ieee, { ...previous, clusters });
          setZigbeeDevices([...zigbeeDevicesRef.current.values()]);
        }
      }

      if (
        frame.direction === 'rx' &&
        frame.groupId === Group.Device &&
        frame.typeId === DeviceType.State &&
        typeof data.id === 'string' &&
        typeof data.board === 'string'
      ) {
        const known = KNOWN_ENTITY_NAMES[data.id];
        const entity: EntityState = {
          ...entitiesRef.current.get(data.id),
          id: data.id,
          board: data.board,
          type: Number(data.entityType ?? -1),
          subtype: Number(data.subtype ?? 0),
          name: known?.name ?? `${entityTypeName(Number(data.entityType ?? -1))} ${shortId(data.id)}`,
          zone: known?.zone,
          timestampMs: Number(data.timestampMs ?? 0),
          lastSeenAt: now,
          result: Number(data.result ?? 0)
        };
        entitiesRef.current.set(entity.id, entity);
        setEntities(sortEntities([...entitiesRef.current.values()]));
        requestEntity(entity);
      }

      if (
        frame.direction === 'rx' &&
        [Group.Light, Group.BinarySensor, Group.NumericSensor].some(
          (groupId) => groupId === frame.groupId
        ) &&
        typeof data.id === 'string' &&
        typeof data.board === 'string'
      ) {
        const inferredType =
          frame.groupId === Group.Light ? 0 : frame.groupId === Group.BinarySensor ? 1 : 2;
        const previous = entitiesRef.current.get(data.id);
        const known = KNOWN_ENTITY_NAMES[data.id];
        const entity: EntityState = {
          ...previous,
          id: data.id,
          board: data.board,
          type: previous?.type ?? inferredType,
          subtype: previous?.subtype ?? 0,
          name: previous?.name ?? known?.name ?? `${entityTypeName(inferredType)} ${shortId(data.id)}`,
          zone: previous?.zone ?? known?.zone,
          timestampMs: Number(data.timestampMs ?? previous?.timestampMs ?? 0),
          lastSeenAt: now,
          result: Number(data.result ?? 0),
          warm: numberOrUndefined(data.warm) ?? previous?.warm,
          cold: numberOrUndefined(data.cold) ?? previous?.cold,
          red: numberOrUndefined(data.red) ?? previous?.red,
          green: numberOrUndefined(data.green) ?? previous?.green,
          blue: numberOrUndefined(data.blue) ?? previous?.blue,
          capabilities: numberOrUndefined(data.capabilities) ?? previous?.capabilities,
          value:
            typeof data.value === 'boolean' || typeof data.value === 'number'
              ? data.value
              : previous?.value,
          sensorClass: numberOrUndefined(data.sensorClass) ?? previous?.sensorClass
        };
        entitiesRef.current.set(entity.id, entity);
        setEntities(sortEntities([...entitiesRef.current.values()]));
      }

      if (
        frame.groupId === Group.Button &&
        frame.typeId === ButtonType.Action &&
        typeof data.id === 'string' &&
        typeof data.board === 'string'
      ) {
        const previous = entitiesRef.current.get(data.id);
        const known = KNOWN_ENTITY_NAMES[data.id];
        const sequence = Number(data.sequence ?? previous?.sequence ?? 0);
        const entity: EntityState = {
          ...previous,
          id: data.id,
          board: data.board,
          type: 3,
          subtype: previous?.subtype ?? 0,
          name: previous?.name ?? known?.name ?? `Button ${shortId(data.id)}`,
          zone: previous?.zone ?? known?.zone,
          timestampMs: Number(data.timestampMs ?? previous?.timestampMs ?? 0),
          lastSeenAt: now,
          result: 0,
          buttonAction: Number(data.action ?? 0),
          sequence
        };
        buttonSequences.current.set(entity.id, sequence);
        entitiesRef.current.set(entity.id, entity);
        setEntities(sortEntities([...entitiesRef.current.values()]));
      }
    },
    [
      appendEvent,
      refreshBoard,
      requestClusters,
      requestEntity,
      requestZigBeeDetails,
      resolveOtaWaiters
    ]
  );

  const handleIssue = useCallback((issue: ParseIssue) => {
    const current = statsRef.current;
    const next = {
      ...current,
      crcErrors: current.crcErrors + (issue.type === 'crc' ? 1 : 0),
      parseErrors: current.parseErrors + (issue.type === 'crc' ? 0 : 1)
    };
    statsRef.current = next;
    if (!firmwareInFlight.current) setStats(next);
  }, []);

  useEffect(() => {
    busRef.current = new WebSerialBus({
      onFrame: handleFrame,
      onIssue: handleIssue,
      onStateChange: (state, error) => {
        setConnection(state);
        setConnectionError(error);
      },
      onPortChange: setPort
    });
    return () => {
      rejectOtaWaiters('Serial transport was closed.');
      void busRef.current?.disconnect();
    };
  }, [handleFrame, handleIssue, rejectOtaWaiters]);

  const scan = useCallback(() => {
    if (connection !== 'connected' || firmwareInFlight.current) return;
    requestedEntityState.current.clear();
    setLastScanAt(Date.now());
    void queueSend(Group.System, SystemType.DiscoverRequest, BROADCAST_ADDRESS);
    for (const board of boardsRef.current.values()) refreshBoard(board.id);
    for (const entity of entitiesRef.current.values()) requestEntity(entity, true);
  }, [connection, queueSend, refreshBoard, requestEntity]);

  useEffect(() => {
    if (connection !== 'connected') return;
    const initialTimer = window.setTimeout(scan, 120);
    if (!autoScan) return () => window.clearTimeout(initialTimer);
    const interval = window.setInterval(scan, SCAN_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [autoScan, connection, scan]);

  const connect = useCallback(async () => {
    setConnectionError(undefined);
    const nextStats = emptyStats();
    statsRef.current = nextStats;
    setStats(nextStats);
    await busRef.current?.connect();
  }, []);

  const disconnect = useCallback(async () => {
    setPairingEndsAt(undefined);
    rejectOtaWaiters('Serial transport was disconnected.');
    await busRef.current?.disconnect();
  }, [rejectOtaWaiters]);

  const pingChip = useCallback(
    async (board: string) => {
      pingRequestedAt.current.set(board, Date.now());
      await queueSend(Group.System, SystemType.PingRequest, board);
    },
    [queueSend]
  );

  const rebootChip = useCallback(
    async (board: string, delayMs = 250) => {
      await queueSend(
        Group.System,
        SystemType.RebootRequest,
        board,
        encodeSystemRebootRequest(delayMs)
      );
    },
    [queueSend]
  );

  const activateFirmware = useCallback(
    async (board: string) => {
      await queueSend(
        Group.System,
        SystemType.RebootRequest,
        board,
        encodeSystemRebootRequest(OTA_REBOOT_DELAY_MS, OTA_REBOOT_REASON)
      );
    },
    [queueSend]
  );

  const startTimer = useCallback(
    async (board: string, timerId: string, timeoutMs: number) => {
      const id = timerId.trim();
      const normalizedTimeout = Math.max(1, Math.min(0xffffffff, Math.round(timeoutMs)));
      const payload = encodeTimerStartRequest(id, normalizedTimeout);
      const key = timerKey(board, id);
      const previous = timersRef.current.get(key);
      const now = Date.now();
      const timer: TimerState = {
        key,
        id,
        board,
        running: true,
        timeoutMs: normalizedTimeout,
        remainingMs: normalizedTimeout,
        generation: previous?.generation ?? 0,
        snapshotAt: now,
        lastSeenAt: previous?.lastSeenAt ?? now
      };
      timersRef.current.set(key, timer);
      setTimers(sortTimers([...timersRef.current.values()]));
      await queueSend(
        Group.System,
        SystemType.TimerStartRequest,
        board,
        payload
      );
    },
    [queueSend]
  );

  const cancelTimer = useCallback(
    async (board: string, timerId: string) => {
      await queueSend(
        Group.System,
        SystemType.TimerCancelRequest,
        board,
        encodeTimerCancelRequest(timerId)
      );
    },
    [queueSend]
  );

  const setLight = useCallback(
    async (id: string, warm: number, cold: number, transitionMs = 250) => {
      const entity = entitiesRef.current.get(id);
      const board = entity?.board ?? boardsRef.current.values().next().value?.id;
      if (!board) return;
      await queueSend(
        Group.Light,
        LightType.SetRequest,
        board,
        encodeLightSet(id, { warm, cold }, transitionMs)
      );
    },
    [queueSend]
  );

  const setGroupPercent = useCallback(
    (percent: number) => {
      const level = Math.round((Math.max(0, Math.min(100, percent)) / 100) * 255);
      return setLight(GROUP_LIGHT_ID, level, 0, 350);
    },
    [setLight]
  );

  const injectMotion = useCallback(
    async (entityId: string) => {
      const entity = entitiesRef.current.get(entityId);
      const board = entity?.board ?? boardsRef.current.values().next().value?.id;
      if (!board) return;
      const timestamp = (Date.now() - stats.startedAt) >>> 0;
      await queueSend(
        Group.BinarySensor,
        SensorType.State,
        board,
        encodeSyntheticMotion(board, entityId, true, timestamp)
      );
      window.setTimeout(() => {
        void queueSend(
          Group.BinarySensor,
          SensorType.State,
          board,
          encodeSyntheticMotion(board, entityId, false, timestamp + 650)
        );
      }, 650);
    },
    [queueSend, stats.startedAt]
  );

  const injectButtonAction = useCallback(
    async (entityId: string, action: number) => {
      const entity = entitiesRef.current.get(entityId);
      const board = entity?.board ?? boardsRef.current.values().next().value?.id;
      if (!board) return;
      const sequence = (buttonSequences.current.get(entityId) ?? entity?.sequence ?? 0) + 1;
      buttonSequences.current.set(entityId, sequence);
      const timestamp = (Date.now() - stats.startedAt) >>> 0;
      await queueSend(
        Group.Button,
        ButtonType.Action,
        board,
        encodeSyntheticButtonAction(board, entityId, action, timestamp, sequence)
      );
    },
    [queueSend, stats.startedAt]
  );

  const setPairing = useCallback(
    async (seconds: number) => {
      const duration = Math.max(0, Math.min(0xffff, Math.round(seconds)));
      const board = zigbeeNetwork?.board ?? boardsRef.current.values().next().value?.id;
      if (!board) return;

      setPairingEndsAt(duration > 0 ? Date.now() + duration * 1000 : undefined);
      setZigbeeNetwork((current) =>
        current ? { ...current, pairing: duration > 0, lastSeenAt: Date.now() } : current
      );

      await queueSend(
        Group.ZigBee,
        ZigBeeType.PairingRequest,
        board,
        encodeZigBeePairingRequest(duration)
      );
    },
    [queueSend, zigbeeNetwork?.board]
  );

  const resetZigBeeNetwork = useCallback(async () => {
    const board = zigbeeNetwork?.board ?? boardsRef.current.values().next().value?.id;
    if (!board) return;

    setPairingEndsAt(undefined);
    await queueSend(Group.ZigBee, ZigBeeType.FactoryResetRequest, board);

    zigbeeDevicesRef.current.clear();
    requestedZigBeeDevice.current.clear();
    requestedZigBeeClusters.current.clear();
    setZigbeeDevices([]);
    setZigbeeNetwork(undefined);
  }, [queueSend, zigbeeNetwork?.board]);

  const updateFirmware = useCallback(
    async (file?: File) => {
      if (firmwareInFlight.current) return;

      const board = boardsRef.current.values().next().value?.id;
      if (!board) {
        setFirmwareUpdate({
          phase: 'error',
          progress: 0,
          message: 'Сначала нужно обнаружить плату через bus.'
        });
        return;
      }

      firmwareInFlight.current = true;
      let sessionStarted = false;
      let publishedProgress = -1;
      let lastState: FirmwareUpdateState = {
        phase: 'loading',
        progress: 0,
        message: 'Загружаю файл прошивки...',
        board
      };
      const setProgress = (state: FirmwareUpdateState, force = true) => {
        lastState = state;
        if (!force && state.progress === publishedProgress) return;
        publishedProgress = state.progress;
        setFirmwareUpdate(state);
        setStats({ ...statsRef.current });
      };

      try {
        setProgress(lastState);
        const image = file ? await loadFirmwareFile(file) : await loadBundledFirmwareImage();
        const imageSize = image.bytes.length;
        if (imageSize <= 0) throw new Error('Файл прошивки пустой.');

        const imageCrc32 = crc32(image.bytes);
        setProgress({
          phase: 'begin',
          progress: 1,
          message: `Начинаю OTA: ${image.fileName}, ${formatFirmwareBytes(imageSize)}.`,
          board,
          fileName: image.fileName,
          bytesSent: 0,
          totalBytes: imageSize
        });

        const beginOtaSession = async () => {
          const beginResponse = waitForOtaResponse(board, OtaType.BeginResponse);
          await queueSend(
            Group.Ota,
            OtaType.BeginRequest,
            board,
            encodeOtaBeginRequest(imageSize, imageCrc32)
          );
          return beginResponse;
        };

        let beginFrame = await beginOtaSession();
        let beginResult = Number(beginFrame.data.result ?? -1);
        if (beginResult === OtaResult.Busy) {
          await queueSend(
            Group.Ota,
            OtaType.AbortRequest,
            board,
            encodeOtaAbortRequest(OtaResult.InternalError)
          );
          await delay(100);
          beginFrame = await beginOtaSession();
          beginResult = Number(beginFrame.data.result ?? -1);
        }
        if (beginResult !== OtaResult.Ok) {
          throw new Error(`OTA Begin failed: ${otaResultName(beginResult)}.`);
        }

        sessionStarted = true;
        const targetSlot = Number(beginFrame.data.targetSlot ?? 0xff);
        let nextOffset = Math.max(0, Number(beginFrame.data.nextOffset ?? 0));
        const uploadStartedAt = performance.now();
        const uploadStartedOffset = nextOffset;

        while (nextOffset < imageSize) {
          const chunkSize = Math.min(OTA_CHUNK_DATA_MAX_SIZE, imageSize - nextOffset);
          const chunkData = image.bytes.subarray(nextOffset, nextOffset + chunkSize);
          const offsetBeforeSend = nextOffset;
          const uploadElapsedSeconds = (performance.now() - uploadStartedAt) / 1000;
          const uploadedBytes = Math.max(0, offsetBeforeSend - uploadStartedOffset);
          const visibleProgress = Math.min(
            98,
            Math.max(2, Math.floor((offsetBeforeSend / imageSize) * 100))
          );

          setProgress(
            {
              phase: 'uploading',
              progress: visibleProgress,
              message: 'Передаю прошивку…',
              board,
              fileName: image.fileName,
              bytesSent: offsetBeforeSend,
              totalBytes: imageSize,
              bytesPerSecond:
                uploadElapsedSeconds > 0 ? uploadedBytes / uploadElapsedSeconds : 0,
              targetSlot
            },
            false
          );

          const chunkResponse = waitForOtaResponse(board, OtaType.ChunkResponse);
          await queueSend(
            Group.Ota,
            OtaType.ChunkRequest,
            board,
            encodeOtaChunkRequest(offsetBeforeSend, chunkData)
          );
          const chunkFrame = await chunkResponse;
          const chunkResult = Number(chunkFrame.data.result ?? -1);

          if (chunkResult === OtaResult.InvalidOffset) {
            nextOffset = Math.max(0, Number(chunkFrame.data.nextOffset ?? nextOffset));
            continue;
          }

          if (chunkResult !== OtaResult.Ok) {
            throw new Error(
              `OTA Chunk failed at ${offsetBeforeSend}: ${otaResultName(chunkResult)}.`
            );
          }

          const reportedOffset = Number(chunkFrame.data.nextOffset ?? 0);
          nextOffset =
            reportedOffset > offsetBeforeSend
              ? Math.min(reportedOffset, imageSize)
              : offsetBeforeSend + chunkSize;
        }

        setProgress({
          phase: 'finishing',
          progress: 99,
          message: 'Проверяю образ прошивки на устройстве...',
          board,
          fileName: image.fileName,
          bytesSent: imageSize,
          totalBytes: imageSize,
          targetSlot
        });

        const finishResponse = waitForOtaResponse(board, OtaType.FinishResponse);
        await queueSend(
          Group.Ota,
          OtaType.FinishRequest,
          board,
          encodeOtaFinishRequest(imageSize, imageCrc32)
        );
        const finishFrame = await finishResponse;
        const finishResult = Number(finishFrame.data.result ?? -1);
        if (finishResult !== OtaResult.Ok) {
          throw new Error(`OTA Finish failed: ${otaResultName(finishResult)}.`);
        }

        setProgress({
          phase: 'done',
          progress: 100,
          message: `Прошивка записана в slot ${Number(finishFrame.data.targetSlot ?? targetSlot)} и выбрана для следующей загрузки.`,
          board,
          fileName: image.fileName,
          bytesSent: imageSize,
          totalBytes: imageSize,
          targetSlot: Number(finishFrame.data.targetSlot ?? targetSlot)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (sessionStarted) {
          await queueSend(
            Group.Ota,
            OtaType.AbortRequest,
            board,
            encodeOtaAbortRequest(OtaResult.InternalError)
          );
        }
        setProgress({
          ...lastState,
          phase: 'error',
          message,
          board
        });
      } finally {
        firmwareInFlight.current = false;
        setStats({ ...statsRef.current });
      }
    },
    [queueSend, waitForOtaResponse]
  );

  const clearFirmwareUpdate = useCallback(() => {
    if (firmwareInFlight.current) return;
    setFirmwareUpdate({ phase: 'idle', progress: 0, message: '' });
  }, []);

  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId);
  const groupLight = entities.find((entity) => entity.id === GROUP_LIGHT_ID);
  const health = useMemo(
    () => ({
      boardsOnline: boards.filter((board) => Date.now() - board.lastSeenAt < 15000).length,
      entityCount: entities.length,
      zigbeeDeviceCount: zigbeeDevices.length
    }),
    [boards, entities, zigbeeDevices]
  );

  return {
    connection,
    connectionError,
    port,
    boards,
    zigbeeNetwork,
    zigbeeDevices,
    entities,
    timers,
    events,
    getBusLog,
    stats,
    firmwareUpdate,
    lastScanAt,
    selectedEntityId,
    selectedEntity,
    groupLight,
    health,
    autoScan,
    pairingEndsAt,
    connect,
    disconnect,
    pingChip,
    rebootChip,
    activateFirmware,
    scan,
    setAutoScan,
    setSelectedEntityId,
    setLight,
    setGroupPercent,
    startTimer,
    cancelTimer,
    setPairing,
    resetZigBeeNetwork,
    injectMotion,
    injectButtonAction,
    updateFirmware,
    clearFirmwareUpdate
  };
}

export type MiniBusLabState = ReturnType<typeof useMiniBusLab>;

function categorizeFrame(frame: ParsedFrame): LabEvent['category'] {
  if (frame.groupId === Group.System) return 'system';
  if (frame.groupId === Group.Ota) return 'system';
  if (frame.groupId === Group.ZigBee) return 'network';
  if (frame.groupId === Group.Logging) {
    const message = String(frame.data.message ?? '').toLowerCase();
    if (
      message.includes('adaptive') ||
      message.includes('ambient light mode') ||
      message.includes('automation')
    ) {
      return 'automation';
    }
    if (Number(frame.data.severity ?? 0) >= 4) return 'error';
  }
  if (
    [Group.Device, Group.Light, Group.BinarySensor, Group.NumericSensor, Group.Button].some(
      (groupId) => groupId === frame.groupId
    )
  ) {
    return 'entity';
  }
  return 'raw';
}

function sortEntities(entities: EntityState[]) {
  return entities.sort((left, right) => left.type - right.type || left.name.localeCompare(right.name));
}

function timerKey(board: string, timerId: string) {
  return `${board}:${timerId}`;
}

function sortTimers(timers: TimerState[]) {
  return timers.sort(
    (left, right) => left.board.localeCompare(right.board) || left.id.localeCompare(right.id)
  );
}

function emptyStats(): TrafficStats {
  return {
    rxPackets: 0,
    txPackets: 0,
    rxBytes: 0,
    txBytes: 0,
    crcErrors: 0,
    parseErrors: 0,
    startedAt: Date.now()
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function shortId(id: string) {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

async function loadFirmwareFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertEspFirmwareImage(bytes, file.name);
  return {
    bytes,
    fileName: file.name
  };
}

async function loadBundledFirmwareImage() {
  for (const url of FIRMWARE_URL_CANDIDATES) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      if (response.headers.get('content-type')?.includes('text/html')) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length <= 0) continue;
      assertEspFirmwareImage(bytes, url);
      return {
        bytes,
        fileName: url.split('/').pop() || url
      };
    } catch {
      // Try the next known firmware location.
    }
  }

  throw new Error(
    'Файл прошивки не найден. Положи ESP-образ в dist как firmware.bin или app.bin.'
  );
}

function assertEspFirmwareImage(bytes: Uint8Array, fileName: string) {
  if (bytes.length === 0 || bytes[0] !== 0xe9) {
    throw new Error(
      `${fileName} не является ESP-образом прошивки: ожидается сигнатура 0xE9.`
    );
  }
}

function formatFirmwareBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
