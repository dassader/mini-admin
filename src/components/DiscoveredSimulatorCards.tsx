import {
  SIMULATOR_BOARD_ID
} from '../bus/base-protocol';
import {
  kitchenEntityIds,
  kitchenLightGroup,
  kitchenLights,
  kitchenZones
} from '../automations/kitchen-entities';
import {
  BINARY_SENSOR_CLASS_MOTION
} from '../bus/binary-sensor-protocol';
import type { Bus } from '../bus/bus';
import {
  DEVICE_TYPE_BINARY_SENSOR,
  DEVICE_TYPE_BUTTON,
  DEVICE_TYPE_LIGHT,
  DEVICE_TYPE_NUMERIC_SENSOR,
  type DeviceState
} from '../bus/device-protocol';
import {
  NUMERIC_SENSOR_CLASS_ILLUMINANCE
} from '../bus/numeric-sensor-protocol';
import {
  SYSTEM_GROUP_ID,
  SYSTEM_TIMER_START_REQUEST,
  type SystemTimerStartRequest
} from '../bus/timer-protocol';
import { useBusInventory, type DiscoveredTimer } from '../hooks/useBusInventory';
import { icons } from '../icons';
import {
  getVirtualLightByEntityId,
  getVirtualLightSensorByEntityId,
  getVirtualMotionSensorByEntityId,
  type SimulatorVirtualDevices
} from '../virtual/simulator-virtual-devices';
import type { TimeController } from '../domain/time';
import { ButtonCard } from './ButtonCard';
import { LightCard } from './LightCard';
import { LightSensorCard } from './LightSensorCard';
import { MotionSensorCard } from './MotionSensorCard';
import { Timer, type TimerMode } from './Timer';
import { UnsupportedDeviceCard } from './UnsupportedDeviceCard';

type DiscoveredSimulatorCardsProps = {
  bus: Bus;
  time: TimeController;
  virtualDevices: SimulatorVirtualDevices;
};

export function DiscoveredSimulatorCards({
  bus,
  time,
  virtualDevices
}: DiscoveredSimulatorCardsProps) {
  const { devices, timers } = useBusInventory(bus);

  return (
    <>
      {devices.map((device) => (
        <DiscoveredDeviceCard
          key={`${device.board}:${device.id}`}
          bus={bus}
          device={device}
          virtualDevices={virtualDevices}
        />
      ))}

      {timers.map((timer) => (
        <DiscoveredTimerCard
          key={`${timer.board}:${timer.timerId}`}
          bus={bus}
          time={time}
          timer={timer}
        />
      ))}
    </>
  );
}

type DiscoveredDeviceCardProps = {
  bus: Bus;
  device: DeviceState;
  virtualDevices: SimulatorVirtualDevices;
};

function DiscoveredDeviceCard({
  bus,
  device,
  virtualDevices
}: DiscoveredDeviceCardProps) {
  if (device.type === DEVICE_TYPE_LIGHT) {
    const known = getVirtualLightByEntityId(virtualDevices, device.id);
    const descriptor = getLightDescriptor(device.id);

    return (
      <LightCard
        bus={bus}
        entityId={device.id}
        id={known?.id ?? descriptor?.id ?? 'light'}
        title={descriptor?.title ?? 'Light'}
        minLevel={known ? known.minLevel : 0}
        maxLevel={known ? known.maxLevel : 255}
        minTemperatureMired={
          known ? known.minTemperatureMired : 153
        }
        maxTemperatureMired={
          known ? known.maxTemperatureMired : 500
        }
      />
    );
  }

  if (device.type === DEVICE_TYPE_NUMERIC_SENSOR) {
    if (device.subtype !== NUMERIC_SENSOR_CLASS_ILLUMINANCE) {
      return (
        <UnsupportedDeviceCard
          title="Unsupported numeric sensor"
          description={`Numeric sensor subtype ${device.subtype} is discovered, but no renderer is registered for it.`}
        />
      );
    }

    const known = getVirtualLightSensorByEntityId(virtualDevices, device.id);
    const descriptor = getIlluminanceDescriptor(device.id);

    return (
      <LightSensorCard
        bus={bus}
        entityId={device.id}
        id={known?.id ?? descriptor?.id ?? 'light-sensor'}
        title="Light sensor"
      />
    );
  }

  if (device.type === DEVICE_TYPE_BINARY_SENSOR) {
    if (device.subtype !== BINARY_SENSOR_CLASS_MOTION) {
      return (
        <UnsupportedDeviceCard
          title="Unsupported binary sensor"
          description={`Binary sensor subtype ${device.subtype} is discovered, but no renderer is registered for it.`}
        />
      );
    }

    const known = getVirtualMotionSensorByEntityId(virtualDevices, device.id);
    const descriptor = getMotionDescriptor(device.id);

    return (
      <MotionSensorCard
        bus={bus}
        entityId={device.id}
        icon={icons.motionSensor}
        id={known?.id ?? descriptor?.id ?? 'motion-sensor'}
        title="Motion sensor"
      />
    );
  }

  if (device.type === DEVICE_TYPE_BUTTON) {
    return (
      <ButtonCard
        bus={bus}
        entityId={device.id}
        id={
          device.id === virtualDevices.button.entityId
            ? virtualDevices.button.id
            : 'button'
        }
        title="Button"
      />
    );
  }

  return (
    <UnsupportedDeviceCard
      title="Unsupported device"
      description={`Device type ${device.type} subtype ${device.subtype} is discovered, but no renderer is registered for it.`}
    />
  );
}

type DiscoveredTimerCardProps = {
  bus: Bus;
  time: TimeController;
  timer: DiscoveredTimer;
};

function DiscoveredTimerCard({ bus, time, timer }: DiscoveredTimerCardProps) {
  const remainingMs = getTimerRemainingMs(timer, time.timestampMs);
  const mode: TimerMode = remainingMs > 0 ? 'running' : 'idle';

  return (
    <Timer
      id={timer.timerId}
      title="Timer"
      timeoutMs={timer.timeoutMs}
      startedAtMs={timer.startedAtMs}
      mode={mode}
      remainingMs={remainingMs}
      onStart={() =>
        bus.send<SystemTimerStartRequest>({
          destination: SIMULATOR_BOARD_ID,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_TIMER_START_REQUEST,
          createdAtMs: time.timestampMs,
          payload: {
            timerId: timer.timerId,
            timeoutMs: timer.timeoutMs
          }
        })
      }
    />
  );
}

function getTimerRemainingMs(timer: DiscoveredTimer, currentTimeMs: number) {
  if (timer.running !== 1) return 0;

  return Math.max(0, timer.remainingMs - (currentTimeMs - timer.snapshotAtMs));
}

function getLightDescriptor(entityId: number) {
  if (kitchenLightGroup.entityId === entityId) return kitchenLightGroup;

  return kitchenLights.find((light) => light.entityId === entityId);
}

function getMotionDescriptor(entityId: number) {
  return kitchenZones
    .map((item) => ({
      id: item.motionKey,
      entityId: kitchenEntityIds[item.motionKey]
    }))
    .find((item) => item.entityId === entityId);
}

function getIlluminanceDescriptor(entityId: number) {
  return kitchenZones
    .map((item) => ({
      id: item.illuminanceKey,
      entityId: kitchenEntityIds[item.illuminanceKey]
    }))
    .find((item) => item.entityId === entityId);
}
