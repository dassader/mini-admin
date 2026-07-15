import type { Bus } from '../bus/bus';
import {
  acceptsDestination,
  BUS_DESTINATION_BROADCAST,
  SIMULATOR_BOARD_ID,
  type BusEntityId
} from '../bus/base-protocol';
import {
  BUTTON_ACTION,
  BUTTON_ACTION_DOUBLE_CLICK,
  BUTTON_ACTION_HOLD_START,
  BUTTON_ACTION_SINGLE_CLICK,
  BUTTON_GROUP_ID,
  type ButtonActionMessage
} from '../bus/button-protocol';
import {
  DEVICE_GROUP_ID,
  DEVICE_LIST_REQUEST,
  DEVICE_TYPE_BUTTON
} from '../bus/device-protocol';
import { publishDeviceState } from '../bus/virtual-device';
import { VirtualDeviceEvents } from './virtual-device-events';

type VirtualButtonOptions = {
  id: string;
  entityId: BusEntityId;
  getTimeMs: () => number;
};

export class VirtualButton extends VirtualDeviceEvents {
  readonly id: string;
  readonly entityId: BusEntityId;

  private bus: Bus | null = null;
  private sequence = 0;
  private lastAction: number | null = null;
  private lastActionAtMs: number | null = null;
  private readonly getTimeMs: () => number;

  constructor({ id, entityId, getTimeMs }: VirtualButtonOptions) {
    super();
    this.id = id;
    this.entityId = entityId;
    this.getTimeMs = getTimeMs;
  }

  connect(bus: Bus) {
    this.bus = bus;

    return bus.listen((message) => {
      if (!acceptsDestination(message)) return;

      if (
        message.group === DEVICE_GROUP_ID &&
        message.type === DEVICE_LIST_REQUEST
      ) {
        publishDeviceState(
          bus,
          {
            id: this.entityId,
            type: DEVICE_TYPE_BUTTON,
            subtype: 0
          },
          this.getTimeMs()
        );
      }
    });
  }

  click() {
    this.publishAction(BUTTON_ACTION_SINGLE_CLICK);
  }

  doubleClick() {
    this.publishAction(BUTTON_ACTION_DOUBLE_CLICK);
  }

  press() {
    this.publishAction(BUTTON_ACTION_HOLD_START);
  }

  getSnapshot() {
    return {
      id: this.id,
      entityId: this.entityId,
      lastAction: this.lastAction,
      lastActionAtMs: this.lastActionAtMs,
      sequence: this.sequence
    };
  }

  private publishAction(action: number) {
    if (!this.bus) return;

    const timestampMs = this.getTimeMs();
    this.sequence = this.sequence === 0xffffffff ? 1 : this.sequence + 1;
    this.lastAction = action;
    this.lastActionAtMs = timestampMs;

    this.bus.send<ButtonActionMessage>({
      destination: BUS_DESTINATION_BROADCAST,
      group: BUTTON_GROUP_ID,
      type: BUTTON_ACTION,
      createdAtMs: timestampMs,
      payload: {
        board: SIMULATOR_BOARD_ID,
        id: this.entityId,
        action,
        timestampMs,
        sequence: this.sequence
      }
    });
    this.notifyListeners();
  }
}
