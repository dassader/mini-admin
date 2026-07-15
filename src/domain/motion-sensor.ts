export type MotionSensorMode = 'idle' | 'motion';

export type MotionSensorState = {
  id: string;
  title: string;
  idleAfterMs: number;
  lastMotionAtMs: number | null;
};

export type MotionSensorSnapshot = MotionSensorState & {
  mode: MotionSensorMode;
  remainingMs: number;
  expiresAtMs: number | null;
};

const initialMotionSensors: MotionSensorState[] = [
  {
    id: 'motion-sensor',
    title: 'Motion sensor',
    idleAfterMs: 30_000,
    lastMotionAtMs: null
  }
];

export function createInitialMotionSensors(): MotionSensorState[] {
  return initialMotionSensors.map((sensor) => ({ ...sensor }));
}

export function triggerMotionSensor(
  sensors: MotionSensorState[],
  sensorId: string,
  triggeredAtMs: number
): MotionSensorState[] {
  let changed = false;

  const nextSensors = sensors.map((sensor) => {
    if (sensor.id !== sensorId) return sensor;

    changed = true;
    return {
      ...sensor,
      lastMotionAtMs: triggeredAtMs
    };
  });

  return changed ? nextSensors : sensors;
}

export function getMotionSensorSnapshot(
  sensor: MotionSensorState,
  currentTimeMs: number
): MotionSensorSnapshot {
  if (sensor.lastMotionAtMs === null) {
    return {
      ...sensor,
      mode: 'idle',
      remainingMs: 0,
      expiresAtMs: null
    };
  }

  const expiresAtMs = sensor.lastMotionAtMs + sensor.idleAfterMs;
  const remainingMs = Math.max(0, expiresAtMs - currentTimeMs);

  return {
    ...sensor,
    mode: remainingMs > 0 ? 'motion' : 'idle',
    remainingMs,
    expiresAtMs
  };
}
