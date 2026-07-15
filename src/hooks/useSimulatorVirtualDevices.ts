import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { Bus } from '../bus/bus';
import type { TimeController } from '../domain/time';
import {
  createSimulatorVirtualDevices,
  getConnectableVirtualDevices,
  type SimulatorVirtualDevices
} from '../virtual/simulator-virtual-devices';

export function useSimulatorVirtualDevices(
  bus: Bus,
  time: TimeController
): SimulatorVirtualDevices {
  const timeMsRef = useRef(time.timestampMs);
  timeMsRef.current = time.timestampMs;

  const virtualDevices = useMemo(
    () =>
      createSimulatorVirtualDevices({
        getTimeMs: () => timeMsRef.current
      }),
    []
  );

  useLayoutEffect(() => {
    const unsubscribers = getConnectableVirtualDevices(virtualDevices).map(
      (device) => device.connect(bus)
    );

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [bus, virtualDevices]);

  useEffect(() => {
    for (const sensor of Object.values(virtualDevices.motionSensors)) {
      sensor.sync();
    }

    const runningTimers = Object.values(virtualDevices.timers)
      .map((timer) => ({
        timer,
        snapshot: timer.getSnapshot()
      }))
      .filter(({ snapshot }) => snapshot.startedAtMs !== null)
      .sort((left, right) => getDueAtMs(left.snapshot) - getDueAtMs(right.snapshot));

    for (const { timer } of runningTimers) {
      timer.sync();
    }
  }, [time.timestampMs, virtualDevices]);

  return virtualDevices;
}

function getDueAtMs(snapshot: {
  startedAtMs: number | null;
  timeoutMs: number;
}) {
  return (snapshot.startedAtMs ?? Number.POSITIVE_INFINITY) + snapshot.timeoutMs;
}
