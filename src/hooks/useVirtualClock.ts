import { useEffect, useMemo, useState } from 'preact/hooks';
import type { TimeController } from '../domain/time';

const CLOCK_TICK_MS = 250;

export function useVirtualClock(): TimeController {
  const [browserNowMs, setBrowserNowMs] = useState(() => Date.now());
  const [offsetMs, setOffsetMs] = useState(0);
  const timestampMs = browserNowMs + offsetMs;
  const current = useMemo(() => new Date(timestampMs), [timestampMs]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setBrowserNowMs(Date.now()),
      CLOCK_TICK_MS
    );

    return () => window.clearInterval(intervalId);
  }, []);

  return useMemo(
    () => ({
      current,
      timestampMs,
      set: (nextTime: Date) => {
        const nowMs = Date.now();
        setBrowserNowMs(nowMs);
        setOffsetMs(nextTime.getTime() - nowMs);
      },
      shiftByMs: (shiftMs: number) => setOffsetMs((currentOffset) => currentOffset + shiftMs),
      resetToBrowserNow: () => {
        setBrowserNowMs(Date.now());
        setOffsetMs(0);
      }
    }),
    [current, timestampMs]
  );
}
