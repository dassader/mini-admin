import type { Bus } from '../bus/bus';
import type { KitchenLightingAutomationRuntime } from '../automations/kitchen-lighting-automations';
import type { SimulatorVirtualDevices } from '../virtual/simulator-virtual-devices';
import { simulatorEntityIds } from '../virtual/simulator-entities';
import {
  kitchenEntityIds,
  kitchenLightGroup,
  kitchenTimerIds
} from '../automations/kitchen-entities';
import {
  BUS_DESTINATION_BROADCAST,
  SIMULATOR_BOARD_ID
} from '../bus/base-protocol';
import {
  BINARY_SENSOR_CLASS_MOTION,
  BINARY_SENSOR_GROUP_ID,
  BINARY_SENSOR_STATE_REQUEST
} from '../bus/binary-sensor-protocol';
import {
  BUTTON_ACTION,
  BUTTON_ACTION_DOUBLE_CLICK,
  BUTTON_ACTION_HOLD_RELEASE,
  BUTTON_ACTION_HOLD_START,
  BUTTON_ACTION_SINGLE_CLICK,
  BUTTON_ACTION_TRIPLE_CLICK,
  BUTTON_GROUP_ID
} from '../bus/button-protocol';
import {
  DEVICE_GROUP_ID,
  DEVICE_LIST_REQUEST,
  DEVICE_STATE,
  DEVICE_TYPE_BINARY_SENSOR,
  DEVICE_TYPE_BUTTON,
  DEVICE_TYPE_LIGHT,
  DEVICE_TYPE_NUMERIC_SENSOR
} from '../bus/device-protocol';
import {
  LIGHT_CHANNEL_BLUE,
  LIGHT_CHANNEL_COLD,
  LIGHT_CHANNEL_GREEN,
  LIGHT_CHANNEL_MASK,
  LIGHT_CHANNEL_RED,
  LIGHT_CHANNEL_WARM,
  LIGHT_GROUP_ID,
  LIGHT_SET_REQUEST,
  LIGHT_STATE_REQUEST
} from '../bus/light-protocol';
import {
  NUMERIC_SENSOR_CLASS_ILLUMINANCE,
  NUMERIC_SENSOR_GROUP_ID,
  NUMERIC_SENSOR_STATE_REQUEST
} from '../bus/numeric-sensor-protocol';
import {
  SYSTEM_DISCOVERY_REQUEST,
  SYSTEM_DISCOVERY_RESPONSE,
  SYSTEM_PING_REQUEST,
  SYSTEM_PING_RESPONSE,
  SYSTEM_STATUS_REQUEST,
  SYSTEM_STATUS_RESPONSE
} from '../bus/system-protocol';
import {
  SYSTEM_GROUP_ID,
  SYSTEM_TIMER_CANCEL_REQUEST,
  SYSTEM_TIMER_CANCEL_RESPONSE,
  SYSTEM_TIMER_EVENT,
  SYSTEM_TIMER_EVENT_REASON_CANCELED,
  SYSTEM_TIMER_EVENT_REASON_EXPIRED,
  SYSTEM_TIMER_LIST_REQUEST,
  SYSTEM_TIMER_LIST_RESPONSE,
  SYSTEM_TIMER_START_REQUEST,
  SYSTEM_TIMER_START_RESPONSE
} from '../bus/timer-protocol';

const allWhiteChannels = LIGHT_CHANNEL_WARM | LIGHT_CHANNEL_COLD;

function createLightSetMessage(
  warmLevel: number,
  coldLevel: number,
  id = simulatorEntityIds.light,
  destination = SIMULATOR_BOARD_ID
) {
  return {
    destination,
    group: LIGHT_GROUP_ID,
    type: LIGHT_SET_REQUEST,
    payload: {
      id,
      channels: allWhiteChannels,
      warmLevel,
      coldLevel,
      redLevel: 0,
      greenLevel: 0,
      blueLevel: 0,
      transitionMs: 0
    }
  };
}

function createBusProtocolConsoleApi() {
  return {
    board: SIMULATOR_BOARD_ID,
    broadcast: BUS_DESTINATION_BROADCAST,
    entity: simulatorEntityIds,
    kitchenEntity: kitchenEntityIds,
    kitchenTimer: kitchenTimerIds,
    group: {
      system: SYSTEM_GROUP_ID,
      device: DEVICE_GROUP_ID,
      light: LIGHT_GROUP_ID,
      binarySensor: BINARY_SENSOR_GROUP_ID,
      numericSensor: NUMERIC_SENSOR_GROUP_ID,
      button: BUTTON_GROUP_ID
    },
    system: {
      discoveryRequest: SYSTEM_DISCOVERY_REQUEST,
      discoveryResponse: SYSTEM_DISCOVERY_RESPONSE,
      pingRequest: SYSTEM_PING_REQUEST,
      pingResponse: SYSTEM_PING_RESPONSE,
      statusRequest: SYSTEM_STATUS_REQUEST,
      statusResponse: SYSTEM_STATUS_RESPONSE,
      timerStartRequest: SYSTEM_TIMER_START_REQUEST,
      timerStartResponse: SYSTEM_TIMER_START_RESPONSE,
      timerCancelRequest: SYSTEM_TIMER_CANCEL_REQUEST,
      timerCancelResponse: SYSTEM_TIMER_CANCEL_RESPONSE,
      timerEvent: SYSTEM_TIMER_EVENT,
      timerListRequest: SYSTEM_TIMER_LIST_REQUEST,
      timerListResponse: SYSTEM_TIMER_LIST_RESPONSE,
      timerEventReason: {
        canceled: SYSTEM_TIMER_EVENT_REASON_CANCELED,
        expired: SYSTEM_TIMER_EVENT_REASON_EXPIRED
      }
    },
    device: {
      listRequest: DEVICE_LIST_REQUEST,
      state: DEVICE_STATE,
      type: {
        light: DEVICE_TYPE_LIGHT,
        binarySensor: DEVICE_TYPE_BINARY_SENSOR,
        numericSensor: DEVICE_TYPE_NUMERIC_SENSOR,
        button: DEVICE_TYPE_BUTTON
      }
    },
    light: {
      stateRequest: LIGHT_STATE_REQUEST,
      setRequest: LIGHT_SET_REQUEST,
      channel: {
        warm: LIGHT_CHANNEL_WARM,
        cold: LIGHT_CHANNEL_COLD,
        red: LIGHT_CHANNEL_RED,
        green: LIGHT_CHANNEL_GREEN,
        blue: LIGHT_CHANNEL_BLUE,
        mask: LIGHT_CHANNEL_MASK
      }
    },
    binarySensor: {
      stateRequest: BINARY_SENSOR_STATE_REQUEST,
      sensorClass: {
        motion: BINARY_SENSOR_CLASS_MOTION
      }
    },
    numericSensor: {
      stateRequest: NUMERIC_SENSOR_STATE_REQUEST,
      sensorClass: {
        illuminance: NUMERIC_SENSOR_CLASS_ILLUMINANCE
      }
    },
    button: {
      action: BUTTON_ACTION,
      actionType: {
        singleClick: BUTTON_ACTION_SINGLE_CLICK,
        doubleClick: BUTTON_ACTION_DOUBLE_CLICK,
        tripleClick: BUTTON_ACTION_TRIPLE_CLICK,
        holdStart: BUTTON_ACTION_HOLD_START,
        holdRelease: BUTTON_ACTION_HOLD_RELEASE
      }
    },
    example: {
      discovery(destination = BUS_DESTINATION_BROADCAST) {
        return {
          destination,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_DISCOVERY_REQUEST
        };
      },
      status(destination = BUS_DESTINATION_BROADCAST) {
        return {
          destination,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_STATUS_REQUEST
        };
      },
      deviceList(destination = BUS_DESTINATION_BROADCAST) {
        return {
          destination,
          group: DEVICE_GROUP_ID,
          type: DEVICE_LIST_REQUEST
        };
      },
      motionState(
        id = simulatorEntityIds.motionSensor,
        destination = BUS_DESTINATION_BROADCAST
      ) {
        return {
          destination,
          group: BINARY_SENSOR_GROUP_ID,
          type: BINARY_SENSOR_STATE_REQUEST,
          payload: { id }
        };
      },
      lightSensorState(
        id = simulatorEntityIds.lightSensor,
        destination = BUS_DESTINATION_BROADCAST
      ) {
        return {
          destination,
          group: NUMERIC_SENSOR_GROUP_ID,
          type: NUMERIC_SENSOR_STATE_REQUEST,
          payload: { id }
        };
      },
      lightState(
        id = kitchenLightGroup.entityId,
        destination = BUS_DESTINATION_BROADCAST
      ) {
        return {
          destination,
          group: LIGHT_GROUP_ID,
          type: LIGHT_STATE_REQUEST,
          payload: { id }
        };
      },
      lightSet(
        warmLevel: number,
        coldLevel: number,
        id = kitchenLightGroup.entityId,
        destination = SIMULATOR_BOARD_ID
      ) {
        return createLightSetMessage(warmLevel, coldLevel, id, destination);
      },
      lightOn(id = kitchenLightGroup.entityId, destination = SIMULATOR_BOARD_ID) {
        return createLightSetMessage(180, 90, id, destination);
      },
      lightOff(id = kitchenLightGroup.entityId, destination = SIMULATOR_BOARD_ID) {
        return createLightSetMessage(0, 0, id, destination);
      },
      timerStart(
        timeoutMs = 60_000,
        timerId = kitchenTimerIds.manualOverride,
        destination = SIMULATOR_BOARD_ID
      ) {
        return {
          destination,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_TIMER_START_REQUEST,
          payload: {
            timerId,
            timeoutMs
          }
        };
      },
      timerCancel(
        timerId = kitchenTimerIds.manualOverride,
        destination = SIMULATOR_BOARD_ID
      ) {
        return {
          destination,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_TIMER_CANCEL_REQUEST,
          payload: { timerId }
        };
      },
      timerList(destination = BUS_DESTINATION_BROADCAST) {
        return {
          destination,
          group: SYSTEM_GROUP_ID,
          type: SYSTEM_TIMER_LIST_REQUEST
        };
      }
    }
  };
}

export type BusProtocolConsoleApi = ReturnType<
  typeof createBusProtocolConsoleApi
>;

declare global {
  interface Window {
    bus?: Bus;
    busProtocol?: BusProtocolConsoleApi;
    virtualDevices?: SimulatorVirtualDevices;
    automations?: KitchenLightingAutomationRuntime;
  }
}

export function installBusConsole(
  bus: Bus,
  virtualDevices?: SimulatorVirtualDevices,
  automations?: KitchenLightingAutomationRuntime
) {
  window.bus = bus;
  window.busProtocol = createBusProtocolConsoleApi();
  window.virtualDevices = virtualDevices;
  window.automations = automations;

  return () => {
    if (window.bus === bus) {
      delete window.bus;
    }

    delete window.busProtocol;
    delete window.virtualDevices;
    delete window.automations;
  };
}
