import type { BusEntityId } from '../bus/base-protocol';

export const kitchenEntityIds = {
  kitchenCabinetLeft: 1101,
  kitchenCabinetRight: 1102,
  entranceTop: 1103,
  ambientLightGroup: 0x1001,
  masterButton: 2001,
  kitchenLeftMotionSensor: 3001,
  kitchenLeftLightSensor: 3002,
  kitchenRightMotionSensor: 3011,
  kitchenRightLightSensor: 3012,
  entranceMotionSensor: 3021,
  entranceLightSensor: 3022
} satisfies Record<string, BusEntityId>;

export const kitchenTimerIds = {
  downgradeHold: 'downgradeHold',
  manualOverride: 'manualOverride',
  startupLightCheck: 'startupLightCheck',
  kitchenLeftIlluminanceFallback: 'kitchenLeftIlluminanceFallback',
  kitchenRightIlluminanceFallback: 'kitchenRightIlluminanceFallback',
  entranceIlluminanceFallback: 'entranceIlluminanceFallback'
} as const;

export type KitchenTimerId =
  (typeof kitchenTimerIds)[keyof typeof kitchenTimerIds];

export const kitchenZones = [
  {
    id: 'KitchenLeft',
    label: 'Kitchen left',
    motionKey: 'kitchenLeftMotionSensor',
    illuminanceKey: 'kitchenLeftLightSensor',
    fallbackTimerId: kitchenTimerIds.kitchenLeftIlluminanceFallback
  },
  {
    id: 'KitchenRight',
    label: 'Kitchen right',
    motionKey: 'kitchenRightMotionSensor',
    illuminanceKey: 'kitchenRightLightSensor',
    fallbackTimerId: kitchenTimerIds.kitchenRightIlluminanceFallback
  },
  {
    id: 'Entrance',
    label: 'Entrance',
    motionKey: 'entranceMotionSensor',
    illuminanceKey: 'entranceLightSensor',
    fallbackTimerId: kitchenTimerIds.entranceIlluminanceFallback
  }
] as const;

export type KitchenZoneId = (typeof kitchenZones)[number]['id'];
export type KitchenMotionSensorKey = (typeof kitchenZones)[number]['motionKey'];
export type KitchenIlluminanceSensorKey =
  (typeof kitchenZones)[number]['illuminanceKey'];

export const kitchenLights = [
  {
    key: 'kitchenCabinetLeft',
    id: 'kitchenCabinetLeft',
    title: 'Light',
    entityId: kitchenEntityIds.kitchenCabinetLeft
  },
  {
    key: 'kitchenCabinetRight',
    id: 'kitchenCabinetRight',
    title: 'Light',
    entityId: kitchenEntityIds.kitchenCabinetRight
  },
  {
    key: 'entranceTop',
    id: 'entranceTop',
    title: 'Light',
    entityId: kitchenEntityIds.entranceTop
  }
] as const;

export type KitchenLightKey = (typeof kitchenLights)[number]['key'];

export const kitchenLightGroup = {
  key: 'ambientLightGroup',
  id: 'ambientLightGroup',
  title: 'Light group',
  groupAddress: 0x1001,
  entityId: kitchenEntityIds.ambientLightGroup,
  memberKeys: kitchenLights.map((light) => light.key)
} as const;

export const kitchenAutomationConfig = {
  lowLux: 30,
  highLux: 200,
  ambientOnLux: 30,
  ambientOffLux: 45,
  fallbackLux: 637,
  minBrightness: 15,
  maxBrightness: 100,
  warmMireds: 500,
  neutralMireds: 329,
  minTemperatureMired: 158,
  maxTemperatureMired: 500,
  ambientBrightnessLevel: 1,
  transitionMs: 300,
  readingFreshMs: 30_000,
  activeZoneHoldMs: 15_000,
  minimumSceneUpdateIntervalMs: 5_000,
  downgradeHoldMs: 30_000,
  brightnessDeadband: 10,
  temperatureDeadbandMireds: 40,
  manualOverrideMs: 5 * 60 * 1_000,
  fallbackTimeoutMs: 1_000,
  illuminanceMinLux: 0,
  illuminanceMaxLux: 600,
  initialIlluminanceLux: 150,
  motionSensorTimeoutMs: 30_000
} as const;
