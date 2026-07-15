import {
  acceptsDestination,
  BUS_DESTINATION_BROADCAST,
  SIMULATOR_BOARD_ID
} from '../bus/base-protocol';
import type { Bus, BusRawMessage } from '../bus/bus';
import {
  SYSTEM_GROUP_ID,
  SYSTEM_TIMER_CANCEL_REQUEST,
  SYSTEM_TIMER_CANCEL_RESPONSE,
  SYSTEM_TIMER_EVENT,
  SYSTEM_TIMER_EVENT_REASON_CANCELED,
  SYSTEM_TIMER_EVENT_REASON_EXPIRED,
  SYSTEM_TIMER_LIST_REQUEST,
  SYSTEM_TIMER_LIST_RESPONSE,
  SYSTEM_TIMER_RESULT_INVALID_NAME,
  SYSTEM_TIMER_RESULT_OK,
  SYSTEM_TIMER_START_REQUEST,
  SYSTEM_TIMER_START_RESPONSE,
  type SystemTimerCancelRequest,
  type SystemTimerCancelResponse,
  type SystemTimerEvent,
  type SystemTimerListResponse,
  type SystemTimerStartRequest,
  type SystemTimerStartResponse
} from '../bus/timer-protocol';
import { VirtualDeviceEvents } from './virtual-device-events';

type VirtualTimerOptions = {
  id: string;
  defaultTimeoutMs?: number;
  getTimeMs: () => number;
};

type VirtualTimerState = {
  timeoutMs: number;
  startedAtMs: number | null;
  generation: number;
  completedGeneration: number | null;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export class VirtualTimer extends VirtualDeviceEvents {
  readonly id: string;

  private bus: Bus | null = null;
  private state: VirtualTimerState = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    startedAtMs: null,
    generation: 0,
    completedGeneration: null
  };
  private readonly getTimeMs: () => number;

  constructor({ id, defaultTimeoutMs = DEFAULT_TIMEOUT_MS, getTimeMs }: VirtualTimerOptions) {
    super();
    this.id = id;
    this.state.timeoutMs = defaultTimeoutMs;
    this.getTimeMs = getTimeMs;
  }

  connect(bus: Bus) {
    this.bus = bus;

    return bus.listen((message) => {
      if (message.group !== SYSTEM_GROUP_ID || !acceptsDestination(message)) return;

      if (message.type === SYSTEM_TIMER_START_REQUEST) {
        this.handleStartRequest(message);
        return;
      }

      if (message.type === SYSTEM_TIMER_CANCEL_REQUEST) {
        this.handleCancelRequest(message);
        return;
      }

      if (message.type === SYSTEM_TIMER_LIST_REQUEST) {
        this.publishListResponse();
      }
    });
  }

  sync() {
    const snapshot = this.getSnapshot();
    if (this.state.startedAtMs === null) return;
    if (snapshot.remainingMs > 0) return;
    if (this.state.completedGeneration === this.state.generation) return;

    this.state = {
      ...this.state,
      startedAtMs: null,
      completedGeneration: this.state.generation
    };
    this.publishTimerEvent(SYSTEM_TIMER_EVENT_REASON_EXPIRED);
    this.notifyListeners();
  }

  getSnapshot() {
    if (this.state.startedAtMs === null) {
      return {
        id: this.id,
        running: false,
        timeoutMs: this.state.timeoutMs,
        remainingMs: 0,
        generation: this.state.generation,
        startedAtMs: null
      };
    }

    const remainingMs = Math.max(
      0,
      this.state.startedAtMs + this.state.timeoutMs - this.getTimeMs()
    );

    return {
      id: this.id,
      running: remainingMs > 0,
      timeoutMs: this.state.timeoutMs,
      remainingMs,
      generation: this.state.generation,
      startedAtMs: this.state.startedAtMs
    };
  }

  private handleStartRequest(message: BusRawMessage) {
    const payload = (message.payload ?? {}) as Partial<SystemTimerStartRequest>;
    const requestTimerId = payload.timerId ?? '';

    if (!isValidTimerId(requestTimerId)) {
      this.publishStartResponse({
        timerId: requestTimerId,
        result: SYSTEM_TIMER_RESULT_INVALID_NAME,
        generation: 0
      });
      return;
    }

    if (requestTimerId !== this.id) return;

    const timeoutMs = normalizeTimeoutMs(payload.timeoutMs);
    const generation = this.state.generation + 1;

    this.state = {
      timeoutMs,
      startedAtMs: this.getTimeMs(),
      generation,
      completedGeneration: null
    };
    this.publishStartResponse({
      timerId: this.id,
      result: SYSTEM_TIMER_RESULT_OK,
      generation
    });
    this.notifyListeners();
  }

  private handleCancelRequest(message: BusRawMessage) {
    const payload = (message.payload ?? {}) as Partial<SystemTimerCancelRequest>;
    const requestTimerId = payload.timerId ?? '';

    if (!isValidTimerId(requestTimerId)) {
      this.publishCancelResponse({
        timerId: requestTimerId,
        result: SYSTEM_TIMER_RESULT_INVALID_NAME,
        generation: 0
      });
      return;
    }

    if (requestTimerId !== this.id) return;

    const snapshot = this.getSnapshot();

    this.state = {
      ...this.state,
      startedAtMs: null,
      completedGeneration: this.state.generation
    };
    this.publishCancelResponse({
      timerId: this.id,
      result: SYSTEM_TIMER_RESULT_OK,
      generation: this.state.generation
    });

    if (snapshot.running) {
      this.publishTimerEvent(SYSTEM_TIMER_EVENT_REASON_CANCELED);
    }

    this.notifyListeners();
  }

  private publishStartResponse(
    payload: Omit<SystemTimerStartResponse, 'board'>
  ) {
    if (!this.bus) return;

    this.bus.send<SystemTimerStartResponse>({
      destination: BUS_DESTINATION_BROADCAST,
      group: SYSTEM_GROUP_ID,
      type: SYSTEM_TIMER_START_RESPONSE,
      createdAtMs: this.getTimeMs(),
      payload: {
        board: SIMULATOR_BOARD_ID,
        ...payload
      }
    });
  }

  private publishCancelResponse(
    payload: Omit<SystemTimerCancelResponse, 'board'>
  ) {
    if (!this.bus) return;

    this.bus.send<SystemTimerCancelResponse>({
      destination: BUS_DESTINATION_BROADCAST,
      group: SYSTEM_GROUP_ID,
      type: SYSTEM_TIMER_CANCEL_RESPONSE,
      createdAtMs: this.getTimeMs(),
      payload: {
        board: SIMULATOR_BOARD_ID,
        ...payload
      }
    });
  }

  private publishTimerEvent(reason: number) {
    if (!this.bus) return;

    this.bus.send<SystemTimerEvent>({
      destination: BUS_DESTINATION_BROADCAST,
      group: SYSTEM_GROUP_ID,
      type: SYSTEM_TIMER_EVENT,
      createdAtMs: this.getTimeMs(),
      payload: {
        board: SIMULATOR_BOARD_ID,
        timerId: this.id,
        reason,
        generation: this.state.generation
      }
    });
  }

  private publishListResponse() {
    if (!this.bus) return;

    const snapshot = this.getSnapshot();

    this.bus.send<SystemTimerListResponse>({
      destination: BUS_DESTINATION_BROADCAST,
      group: SYSTEM_GROUP_ID,
      type: SYSTEM_TIMER_LIST_RESPONSE,
      createdAtMs: this.getTimeMs(),
      payload: {
        board: SIMULATOR_BOARD_ID,
        timerId: this.id,
        running: snapshot.running ? 1 : 0,
        timeoutMs: snapshot.timeoutMs,
        remainingMs: snapshot.remainingMs,
        generation: snapshot.generation
      }
    });
  }
}

function normalizeTimeoutMs(timeoutMs: unknown) {
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(0xffffffff, Math.max(0, Math.round(timeoutMs)));
}

function isValidTimerId(timerId: string) {
  return timerId.length > 0 && timerId.length <= 31 && !timerId.includes('\0');
}
