import { useEffect, useRef } from 'preact/hooks';
import type { Bus } from '../bus/bus';
import {
  acceptsDestination,
  BUS_DESTINATION_BROADCAST,
  SIMULATOR_BOARD_ID
} from '../bus/base-protocol';
import {
  SYSTEM_GROUP_ID
} from '../bus/timer-protocol';
import {
  SYSTEM_DISCOVERY_REQUEST,
  SYSTEM_DISCOVERY_RESPONSE,
  SYSTEM_PING_REQUEST,
  SYSTEM_PING_RESPONSE,
  SYSTEM_RESET_REASON_POWERON,
  SYSTEM_STATUS_REQUEST,
  SYSTEM_STATUS_RESPONSE,
  type SystemDiscoveryResponse,
  type SystemPingResponse,
  type SystemStatusResponse
} from '../bus/system-protocol';
import type { TimeController } from '../domain/time';

type UseVirtualSystemProtocolInput = {
  bus: Bus;
  time: TimeController;
};

export function useVirtualSystemProtocol({
  bus,
  time
}: UseVirtualSystemProtocolInput) {
  const bootAtMsRef = useRef(time.timestampMs);
  const timeRef = useRef(time.timestampMs);

  timeRef.current = time.timestampMs;

  useEffect(() => {
    const unsubscribe = bus.listen((message) => {
      if (message.group !== SYSTEM_GROUP_ID || !acceptsDestination(message)) return;

      if (message.type === SYSTEM_DISCOVERY_REQUEST) {
        bus.send<SystemDiscoveryResponse>({
          destination: BUS_DESTINATION_BROADCAST,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_DISCOVERY_RESPONSE,
          createdAtMs: timeRef.current,
          payload: {
            board: SIMULATOR_BOARD_ID
          }
        });
        return;
      }

      if (message.type === SYSTEM_PING_REQUEST) {
        bus.send<SystemPingResponse>({
          destination: BUS_DESTINATION_BROADCAST,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_PING_RESPONSE,
          createdAtMs: timeRef.current,
          payload: {
            board: SIMULATOR_BOARD_ID
          }
        });
        return;
      }

      if (message.type === SYSTEM_STATUS_REQUEST) {
        bus.send<SystemStatusResponse>({
          destination: BUS_DESTINATION_BROADCAST,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_STATUS_RESPONSE,
          createdAtMs: timeRef.current,
          payload: {
            board: SIMULATOR_BOARD_ID,
            resetReason: SYSTEM_RESET_REASON_POWERON,
            uptimeMs: Math.max(0, timeRef.current - bootAtMsRef.current)
          }
        });
      }
    });

    return unsubscribe;
  }, [bus]);
}
