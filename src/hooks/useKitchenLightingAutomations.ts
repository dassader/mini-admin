import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { Bus } from '../bus/bus';
import type { TimeController } from '../domain/time';
import { KitchenLightingAutomationRuntime } from '../automations/kitchen-lighting-automations';

export function useKitchenLightingAutomations(bus: Bus, time: TimeController) {
  const timeMsRef = useRef(time.timestampMs);
  timeMsRef.current = time.timestampMs;

  const automations = useMemo(
    () =>
      new KitchenLightingAutomationRuntime({
        getTimeMs: () => timeMsRef.current
      }),
    []
  );

  useEffect(() => automations.connect(bus), [automations, bus]);

  return automations;
}
