import {
  kitchenAutomationConfig,
  kitchenEntityIds,
  kitchenLightGroup,
  kitchenLights,
  kitchenTimerIds,
  kitchenZones,
  type KitchenIlluminanceSensorKey,
  type KitchenLightKey,
  type KitchenMotionSensorKey,
  type KitchenTimerId
} from '../automations/kitchen-entities';
import {
  NUMERIC_SENSOR_CLASS_ILLUMINANCE
} from '../bus/numeric-sensor-protocol';
import { VirtualButton } from './VirtualButton';
import { VirtualLight } from './VirtualLight';
import { VirtualLightGroup } from './VirtualLightGroup';
import { VirtualMotionSensor } from './VirtualMotionSensor';
import { VirtualNumericSensor } from './VirtualNumericSensor';
import { VirtualTimer } from './VirtualTimer';

type ConnectableVirtualDevice = {
  connect: (bus: Parameters<VirtualLight['connect']>[0]) => () => void;
};

export type SimulatorVirtualDevices = {
  lights: Record<KitchenLightKey, VirtualLight>;
  lightGroup: VirtualLightGroup;
  motionSensors: Record<KitchenMotionSensorKey, VirtualMotionSensor>;
  lightSensors: Record<KitchenIlluminanceSensorKey, VirtualNumericSensor>;
  button: VirtualButton;
  timers: Record<KitchenTimerId, VirtualTimer>;
  motionSensor: VirtualMotionSensor;
  lightSensor: VirtualNumericSensor;
  light: VirtualLightGroup;
};

type CreateSimulatorVirtualDevicesInput = {
  getTimeMs: () => number;
};

export function createSimulatorVirtualDevices({
  getTimeMs
}: CreateSimulatorVirtualDevicesInput): SimulatorVirtualDevices {
  const lightOptions = {
    initialLevel: 0,
    minLevel: 0,
    maxLevel: 254,
    initialTemperatureMired: kitchenAutomationConfig.warmMireds,
    minTemperatureMired: kitchenAutomationConfig.minTemperatureMired,
    maxTemperatureMired: kitchenAutomationConfig.maxTemperatureMired,
    getTimeMs
  };

  const lights = Object.fromEntries(
    kitchenLights.map((light) => [
      light.key,
      new VirtualLight({
        id: light.id,
        entityId: light.entityId,
        ...lightOptions
      })
    ])
  ) as Record<KitchenLightKey, VirtualLight>;

  const lightGroup = new VirtualLightGroup({
    id: kitchenLightGroup.id,
    entityId: kitchenLightGroup.entityId,
    members: kitchenLights.map((light) => lights[light.key]),
    ...lightOptions
  });

  const motionSensors = Object.fromEntries(
    kitchenZones.map((zone) => [
      zone.motionKey,
      new VirtualMotionSensor({
        id: zone.motionKey,
        entityId: kitchenEntityIds[zone.motionKey],
        idleAfterMs: kitchenAutomationConfig.motionSensorTimeoutMs,
        getTimeMs
      })
    ])
  ) as Record<KitchenMotionSensorKey, VirtualMotionSensor>;

  const lightSensors = Object.fromEntries(
    kitchenZones.map((zone) => [
      zone.illuminanceKey,
      new VirtualNumericSensor({
        id: zone.illuminanceKey,
        entityId: kitchenEntityIds[zone.illuminanceKey],
        sensorClass: NUMERIC_SENSOR_CLASS_ILLUMINANCE,
        initialRawValue: kitchenAutomationConfig.initialIlluminanceLux,
        minRawValue: kitchenAutomationConfig.illuminanceMinLux,
        maxRawValue: kitchenAutomationConfig.illuminanceMaxLux,
        getTimeMs
      })
    ])
  ) as Record<KitchenIlluminanceSensorKey, VirtualNumericSensor>;

  const button = new VirtualButton({
    id: 'masterButton',
    entityId: kitchenEntityIds.masterButton,
    getTimeMs
  });

  const timers = {
    [kitchenTimerIds.downgradeHold]: new VirtualTimer({
      id: kitchenTimerIds.downgradeHold,
      defaultTimeoutMs: kitchenAutomationConfig.downgradeHoldMs,
      getTimeMs
    }),
    [kitchenTimerIds.manualOverride]: new VirtualTimer({
      id: kitchenTimerIds.manualOverride,
      defaultTimeoutMs: kitchenAutomationConfig.manualOverrideMs,
      getTimeMs
    }),
    [kitchenTimerIds.startupLightCheck]: new VirtualTimer({
      id: kitchenTimerIds.startupLightCheck,
      defaultTimeoutMs: 3_000,
      getTimeMs
    }),
    [kitchenTimerIds.kitchenLeftIlluminanceFallback]: new VirtualTimer({
      id: kitchenTimerIds.kitchenLeftIlluminanceFallback,
      defaultTimeoutMs: kitchenAutomationConfig.fallbackTimeoutMs,
      getTimeMs
    }),
    [kitchenTimerIds.kitchenRightIlluminanceFallback]: new VirtualTimer({
      id: kitchenTimerIds.kitchenRightIlluminanceFallback,
      defaultTimeoutMs: kitchenAutomationConfig.fallbackTimeoutMs,
      getTimeMs
    }),
    [kitchenTimerIds.entranceIlluminanceFallback]: new VirtualTimer({
      id: kitchenTimerIds.entranceIlluminanceFallback,
      defaultTimeoutMs: kitchenAutomationConfig.fallbackTimeoutMs,
      getTimeMs
    })
  } satisfies Record<KitchenTimerId, VirtualTimer>;

  return {
    lights,
    lightGroup,
    motionSensors,
    lightSensors,
    button,
    timers,
    motionSensor: motionSensors.kitchenLeftMotionSensor,
    lightSensor: lightSensors.kitchenLeftLightSensor,
    light: lightGroup
  };
}

export function getConnectableVirtualDevices(
  devices: SimulatorVirtualDevices
): ConnectableVirtualDevice[] {
  return [
    ...Object.values(devices.lights),
    devices.lightGroup,
    ...Object.values(devices.motionSensors),
    ...Object.values(devices.lightSensors),
    devices.button,
    ...Object.values(devices.timers)
  ];
}

export function getVirtualLightByEntityId(
  devices: SimulatorVirtualDevices,
  entityId: number
) {
  if (devices.lightGroup.entityId === entityId) return devices.lightGroup;

  return Object.values(devices.lights).find((light) => light.entityId === entityId);
}

export function getVirtualMotionSensorByEntityId(
  devices: SimulatorVirtualDevices,
  entityId: number
) {
  return Object.values(devices.motionSensors).find(
    (sensor) => sensor.entityId === entityId
  );
}

export function getVirtualLightSensorByEntityId(
  devices: SimulatorVirtualDevices,
  entityId: number
) {
  return Object.values(devices.lightSensors).find(
    (sensor) => sensor.entityId === entityId
  );
}
