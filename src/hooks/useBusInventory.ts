import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  BUS_DESTINATION_BROADCAST,
  type BusEntityId
} from '../bus/base-protocol';
import type { Bus, BusRawMessage } from '../bus/bus';
import {
  DEVICE_GROUP_ID,
  DEVICE_LIST_REQUEST,
  DEVICE_RESULT_OK,
  DEVICE_RESULT_STATE_CHANGED,
  DEVICE_STATE,
  type DeviceState
} from '../bus/device-protocol';
import {
  SYSTEM_GROUP_ID,
  SYSTEM_TIMER_CANCEL_RESPONSE,
  SYSTEM_TIMER_EVENT,
  SYSTEM_TIMER_EVENT_REASON_CANCELED,
  SYSTEM_TIMER_EVENT_REASON_EXPIRED,
  SYSTEM_TIMER_LIST_REQUEST,
  SYSTEM_TIMER_LIST_RESPONSE,
  SYSTEM_TIMER_RESULT_OK,
  SYSTEM_TIMER_START_REQUEST,
  SYSTEM_TIMER_START_RESPONSE,
  type SystemTimerCancelResponse,
  type SystemTimerEvent,
  type SystemTimerListResponse,
  type SystemTimerStartRequest,
  type SystemTimerStartResponse
} from '../bus/timer-protocol';

export type DiscoveredDevice = DeviceState;

export type DiscoveredTimer = {
  board: string;
  timerId: string;
  running: 0 | 1;
  timeoutMs: number;
  remainingMs: number;
  generation: number;
  snapshotAtMs: number;
  startedAtMs: number | null;
};

export function useBusInventory(bus: Bus) {
  const [deviceMap, setDeviceMap] = useState(() => new Map<string, DiscoveredDevice>());
  const [timerMap, setTimerMap] = useState(() => new Map<string, DiscoveredTimer>());

  useEffect(() => {
    const unsubscribe = bus.listen((message) => {
      if (message.group === DEVICE_GROUP_ID && message.type === DEVICE_STATE) {
        const payload = message.payload as Partial<DeviceState> | undefined;

        if (!isUsableDeviceState(payload)) return;

        setDeviceMap((current) => {
          const next = new Map(current);
          next.set(getDeviceKey(payload), payload);
          return next;
        });
        return;
      }

      if (
        message.group === SYSTEM_GROUP_ID &&
        message.type === SYSTEM_TIMER_START_REQUEST
      ) {
        const payload = message.payload as Partial<SystemTimerStartRequest> | undefined;

        if (!payload?.timerId || typeof payload.timeoutMs !== 'number') return;

        const timerId = payload.timerId;
        const timeoutMs = payload.timeoutMs;

        setTimerMap((current) => {
          const next = new Map(current);
          const previous = next.get(timerId);
          next.set(timerId, {
            board: previous?.board ?? '',
            timerId,
            running: 1,
            timeoutMs,
            remainingMs: timeoutMs,
            generation: previous?.generation ?? 0,
            snapshotAtMs: message.createdAtMs,
            startedAtMs: message.createdAtMs
          });
          return next;
        });
        return;
      }

      if (
        message.group === SYSTEM_GROUP_ID &&
        message.type === SYSTEM_TIMER_LIST_RESPONSE
      ) {
        const payload = message.payload as Partial<SystemTimerListResponse> | undefined;

        if (!isTimerListResponse(payload)) return;

        setTimerMap((current) => {
          const next = new Map(current);
          next.set(payload.timerId, createTimerFromListResponse(payload, message));
          return next;
        });
        return;
      }

      if (
        message.group === SYSTEM_GROUP_ID &&
        message.type === SYSTEM_TIMER_START_RESPONSE
      ) {
        const payload = message.payload as Partial<SystemTimerStartResponse> | undefined;

        if (!payload?.timerId || payload.result !== SYSTEM_TIMER_RESULT_OK) return;

        const timerId = payload.timerId;
        const board = payload.board;
        const generation = payload.generation ?? 0;

        setTimerMap((current) => {
          const next = new Map(current);
          const previous = next.get(timerId);
          const timeoutMs = previous?.timeoutMs ?? 0;
          const snapshotAtMs = previous?.snapshotAtMs ?? message.createdAtMs;

          next.set(timerId, {
            board: board ?? previous?.board ?? '',
            timerId,
            running: 1,
            timeoutMs,
            remainingMs: timeoutMs,
            generation,
            snapshotAtMs,
            startedAtMs: previous?.startedAtMs ?? snapshotAtMs
          });
          return next;
        });
        return;
      }

      if (
        message.group === SYSTEM_GROUP_ID &&
        message.type === SYSTEM_TIMER_CANCEL_RESPONSE
      ) {
        const payload = message.payload as Partial<SystemTimerCancelResponse> | undefined;

        if (!payload?.timerId || payload.result !== SYSTEM_TIMER_RESULT_OK) return;

        const timerId = payload.timerId;
        const board = payload.board;
        const generation = payload.generation ?? 0;

        setTimerMap((current) => {
          const next = new Map(current);
          const previous = next.get(timerId);
          next.set(timerId, {
            board: board ?? previous?.board ?? '',
            timerId,
            running: 0,
            timeoutMs: previous?.timeoutMs ?? 0,
            remainingMs: 0,
            generation,
            snapshotAtMs: message.createdAtMs,
            startedAtMs: null
          });
          return next;
        });
        return;
      }

      if (message.group === SYSTEM_GROUP_ID && message.type === SYSTEM_TIMER_EVENT) {
        const payload = message.payload as Partial<SystemTimerEvent> | undefined;

        if (
          !payload?.timerId ||
          (payload.reason !== SYSTEM_TIMER_EVENT_REASON_CANCELED &&
            payload.reason !== SYSTEM_TIMER_EVENT_REASON_EXPIRED)
        ) return;

        const timerId = payload.timerId;
        const board = payload.board;
        const generation = payload.generation;

        setTimerMap((current) => {
          const next = new Map(current);
          const previous = next.get(timerId);
          next.set(timerId, {
            board: board ?? previous?.board ?? '',
            timerId,
            running: 0,
            timeoutMs: previous?.timeoutMs ?? 0,
            remainingMs: 0,
            generation: generation ?? previous?.generation ?? 0,
            snapshotAtMs: message.createdAtMs,
            startedAtMs: null
          });
          return next;
        });
      }
    });

    bus.send({
      destination: BUS_DESTINATION_BROADCAST,
      group: DEVICE_GROUP_ID,
      type: DEVICE_LIST_REQUEST
    });
    bus.send({
      destination: BUS_DESTINATION_BROADCAST,
      group: SYSTEM_GROUP_ID,
      type: SYSTEM_TIMER_LIST_REQUEST
    });

    return unsubscribe;
  }, [bus]);

  const devices = useMemo(
    () =>
      [...deviceMap.values()].sort((left, right) =>
        left.id === right.id ? left.type - right.type : left.id - right.id
      ),
    [deviceMap]
  );
  const timers = useMemo(
    () => [...timerMap.values()].sort((left, right) => left.timerId.localeCompare(right.timerId)),
    [timerMap]
  );

  return {
    devices,
    timers
  };
}

function isUsableDeviceState(
  payload: Partial<DeviceState> | undefined
): payload is DeviceState {
  if (!payload) return false;

  return (
    typeof payload.board === 'string' &&
    typeof payload.id === 'number' &&
    typeof payload.type === 'number' &&
    typeof payload.subtype === 'number' &&
    typeof payload.timestampMs === 'number' &&
    (payload.result === DEVICE_RESULT_OK ||
      payload.result === DEVICE_RESULT_STATE_CHANGED)
  );
}

function isTimerListResponse(
  payload: Partial<SystemTimerListResponse> | undefined
): payload is SystemTimerListResponse {
  if (!payload) return false;

  return (
    typeof payload.board === 'string' &&
    typeof payload.timerId === 'string' &&
    (payload.running === 0 || payload.running === 1) &&
    typeof payload.timeoutMs === 'number' &&
    typeof payload.remainingMs === 'number' &&
    typeof payload.generation === 'number'
  );
}

function createTimerFromListResponse(
  payload: SystemTimerListResponse,
  message: BusRawMessage
): DiscoveredTimer {
  const startedAtMs =
    payload.running === 1
      ? message.createdAtMs - Math.max(0, payload.timeoutMs - payload.remainingMs)
      : null;

  return {
    board: payload.board,
    timerId: payload.timerId,
    running: payload.running,
    timeoutMs: payload.timeoutMs,
    remainingMs: payload.remainingMs,
    generation: payload.generation,
    snapshotAtMs: message.createdAtMs,
    startedAtMs
  };
}

function getDeviceKey(device: { board: string; id: BusEntityId }) {
  return `${device.board}:${device.id}`;
}
