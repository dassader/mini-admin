import type { Bus } from '../bus/bus';
import {
  acceptsDestination,
  BUS_DESTINATION_BROADCAST,
  isValidEntityId,
  SIMULATOR_BOARD_ID,
  type BusEntityId
} from '../bus/base-protocol';
import {
  DEVICE_GROUP_ID,
  DEVICE_LIST_REQUEST,
  DEVICE_TYPE_LIGHT
} from '../bus/device-protocol';
import {
  LIGHT_CAPABILITY_TRANSITION,
  LIGHT_CHANNEL_BLUE,
  LIGHT_CHANNEL_COLD,
  LIGHT_CHANNEL_GREEN,
  LIGHT_CHANNEL_MASK,
  LIGHT_CHANNEL_RED,
  LIGHT_CHANNEL_WARM,
  LIGHT_GROUP_ID,
  LIGHT_RESULT_INVALID_REQUEST,
  LIGHT_RESULT_OK,
  LIGHT_RESULT_STATE_CHANGED,
  LIGHT_RESULT_UNSUPPORTED,
  LIGHT_SET_REQUEST,
  LIGHT_SET_RESPONSE,
  LIGHT_STATE,
  LIGHT_STATE_REQUEST,
  type LightSetRequest,
  type LightSetResponse,
  type LightState,
  type LightStateRequest
} from '../bus/light-protocol';
import { publishDeviceState } from '../bus/virtual-device';
import { VirtualDeviceEvents } from './virtual-device-events';

type VirtualLightOptions = {
  id: string;
  entityId: BusEntityId;
  initialLevel: number;
  initialTemperatureMired: number;
  minLevel: number;
  maxLevel: number;
  minTemperatureMired: number;
  maxTemperatureMired: number;
  getTimeMs: () => number;
};

type LightChannels = {
  warmLevel: number;
  coldLevel: number;
  redLevel: number;
  greenLevel: number;
  blueLevel: number;
};

const SUPPORTED_CHANNELS = LIGHT_CHANNEL_WARM | LIGHT_CHANNEL_COLD;
const CAPABILITIES = SUPPORTED_CHANNELS | LIGHT_CAPABILITY_TRANSITION;

export class VirtualLight extends VirtualDeviceEvents {
  readonly id: string;
  readonly entityId: BusEntityId;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly minTemperatureMired: number;
  readonly maxTemperatureMired: number;

  private bus: Bus | null = null;
  private channels: LightChannels;
  private temperatureMired: number;
  private lastChangedAtMs: number | null = null;
  private lastTransitionMs = 0;
  private readonly getTimeMs: () => number;

  constructor({
    id,
    entityId,
    initialLevel,
    initialTemperatureMired,
    minLevel,
    maxLevel,
    minTemperatureMired,
    maxTemperatureMired,
    getTimeMs
  }: VirtualLightOptions) {
    super();
    this.id = id;
    this.entityId = entityId;
    this.minLevel = minLevel;
    this.maxLevel = maxLevel;
    this.minTemperatureMired = minTemperatureMired;
    this.maxTemperatureMired = maxTemperatureMired;
    this.temperatureMired = clamp(
      initialTemperatureMired,
      minTemperatureMired,
      maxTemperatureMired
    );
    this.channels = channelsFromLevelAndTemperature(
      initialLevel,
      this.temperatureMired,
      minTemperatureMired,
      maxTemperatureMired
    );
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
            type: DEVICE_TYPE_LIGHT,
            subtype: CAPABILITIES
          },
          this.getTimeMs()
        );
        return;
      }

      if (message.group !== LIGHT_GROUP_ID) return;

      if (message.type === LIGHT_STATE_REQUEST) {
        const payload = (message.payload ?? {}) as Partial<LightStateRequest>;

        if (!isValidEntityId(payload.id)) {
          this.publishState(LIGHT_RESULT_INVALID_REQUEST, 0);
          return;
        }

        if (payload.id !== this.entityId) {
          return;
        }

        this.publishState(LIGHT_RESULT_OK, this.entityId);
        return;
      }

      if (message.type === LIGHT_SET_REQUEST) {
        const payload = (message.payload ?? {}) as Partial<LightSetRequest>;

        if (!isValidEntityId(payload.id)) {
          this.publishSetResponse(LIGHT_RESULT_INVALID_REQUEST, 0);
          return;
        }

        if (payload.id !== this.entityId) {
          return;
        }

        this.handleSetRequest(payload);
      }
    });
  }

  setLevelAndTemperature(
    level: number,
    temperatureMired: number,
    transitionMs = 0
  ) {
    const nextTemperature = clamp(
      Math.round(temperatureMired),
      this.minTemperatureMired,
      this.maxTemperatureMired
    );
    const nextLevel = clamp(Math.round(level), this.minLevel, this.maxLevel);
    const nextTransitionMs = clampTransitionMs(transitionMs);

    this.temperatureMired = nextTemperature;
    this.channels = channelsFromLevelAndTemperature(
      nextLevel,
      nextTemperature,
      this.minTemperatureMired,
      this.maxTemperatureMired
    );
    this.lastChangedAtMs = this.getTimeMs();
    this.lastTransitionMs = nextTransitionMs;
    this.publishState(
      LIGHT_RESULT_STATE_CHANGED,
      this.entityId,
      this.lastChangedAtMs,
      nextTransitionMs
    );
    this.notifyListeners();
  }

  setLevel(level: number) {
    this.setLevelAndTemperature(level, this.temperatureMired);
  }

  setTemperatureMired(temperatureMired: number) {
    this.setLevelAndTemperature(this.getDisplayState().level, temperatureMired);
  }

  turnOff() {
    this.setLevel(0);
  }

  getSnapshot() {
    return {
      id: this.id,
      entityId: this.entityId,
      capabilities: CAPABILITIES,
      channels: this.channels,
      lastChangedAtMs: this.lastChangedAtMs,
      transitionMs: this.lastTransitionMs,
      ...this.getDisplayState()
    };
  }

  private handleSetRequest(payload: Partial<LightSetRequest>) {
    const result = validateSetRequest(payload);

    this.publishSetResponse(result, this.entityId);
    if (result !== LIGHT_RESULT_OK) return;

    const transitionMs = clampTransitionMs(payload.transitionMs ?? 0);

    this.channels = applySetRequest(this.channels, payload);
    this.temperatureMired = deriveDisplayState(
      this.channels,
      this.temperatureMired,
      this.minTemperatureMired,
      this.maxTemperatureMired
    ).temperatureMired;
    this.lastChangedAtMs = this.getTimeMs();
    this.lastTransitionMs = transitionMs;
    this.publishState(
      LIGHT_RESULT_STATE_CHANGED,
      this.entityId,
      this.lastChangedAtMs,
      transitionMs
    );
    this.notifyListeners();
  }

  private getDisplayState() {
    return deriveDisplayState(
      this.channels,
      this.temperatureMired,
      this.minTemperatureMired,
      this.maxTemperatureMired
    );
  }

  private publishState(
    result: number,
    entityId: BusEntityId,
    timestampMs = this.getTimeMs(),
    transitionMs = 0
  ) {
    if (!this.bus) return;

    const isSuccess =
      result === LIGHT_RESULT_OK || result === LIGHT_RESULT_STATE_CHANGED;

    this.bus.send<LightState>({
      destination: BUS_DESTINATION_BROADCAST,
      group: LIGHT_GROUP_ID,
      type: LIGHT_STATE,
      createdAtMs: timestampMs,
      payload: {
        board: SIMULATOR_BOARD_ID,
        id: entityId,
        result,
        timestampMs: isSuccess ? timestampMs : 0,
        capabilities: isSuccess ? CAPABILITIES : 0,
        warmLevel: isSuccess ? this.channels.warmLevel : 0,
        coldLevel: isSuccess ? this.channels.coldLevel : 0,
        redLevel: isSuccess ? this.channels.redLevel : 0,
        greenLevel: isSuccess ? this.channels.greenLevel : 0,
        blueLevel: isSuccess ? this.channels.blueLevel : 0,
        transitionMs: isSuccess ? transitionMs : 0
      }
    });
  }

  private publishSetResponse(result: number, entityId: BusEntityId) {
    if (!this.bus) return;

    this.bus.send<LightSetResponse>({
      destination: BUS_DESTINATION_BROADCAST,
      group: LIGHT_GROUP_ID,
      type: LIGHT_SET_RESPONSE,
      createdAtMs: this.getTimeMs(),
      payload: {
        board: SIMULATOR_BOARD_ID,
        id: entityId,
        result
      }
    });
  }
}

function validateSetRequest(payload: Partial<LightSetRequest>) {
  const channels = payload.channels;

  if (typeof channels !== 'number' || channels === 0) {
    return LIGHT_RESULT_INVALID_REQUEST;
  }

  if ((channels & ~LIGHT_CHANNEL_MASK) !== 0) {
    return LIGHT_RESULT_INVALID_REQUEST;
  }

  if ((channels & ~SUPPORTED_CHANNELS) !== 0) {
    return LIGHT_RESULT_UNSUPPORTED;
  }

  const transitionMs = payload.transitionMs;

  if (!isTransitionMs(transitionMs)) {
    return LIGHT_RESULT_INVALID_REQUEST;
  }

  if (transitionMs > 0 && (CAPABILITIES & LIGHT_CAPABILITY_TRANSITION) === 0) {
    return LIGHT_RESULT_UNSUPPORTED;
  }

  if (
    !isByte(payload.warmLevel) ||
    !isByte(payload.coldLevel) ||
    !isByte(payload.redLevel) ||
    !isByte(payload.greenLevel) ||
    !isByte(payload.blueLevel)
  ) {
    return LIGHT_RESULT_INVALID_REQUEST;
  }

  return LIGHT_RESULT_OK;
}

function applySetRequest(
  current: LightChannels,
  payload: Partial<LightSetRequest>
): LightChannels {
  const channels = payload.channels ?? 0;

  return {
    warmLevel:
      channels & LIGHT_CHANNEL_WARM
        ? clampByte(payload.warmLevel ?? 0)
        : current.warmLevel,
    coldLevel:
      channels & LIGHT_CHANNEL_COLD
        ? clampByte(payload.coldLevel ?? 0)
        : current.coldLevel,
    redLevel:
      channels & LIGHT_CHANNEL_RED ? clampByte(payload.redLevel ?? 0) : current.redLevel,
    greenLevel:
      channels & LIGHT_CHANNEL_GREEN
        ? clampByte(payload.greenLevel ?? 0)
        : current.greenLevel,
    blueLevel:
      channels & LIGHT_CHANNEL_BLUE ? clampByte(payload.blueLevel ?? 0) : current.blueLevel
  };
}

function channelsFromLevelAndTemperature(
  level: number,
  temperatureMired: number,
  minTemperatureMired: number,
  maxTemperatureMired: number
): LightChannels {
  const clampedLevel = clampByte(level);
  const warmRatio = getWarmRatio(
    temperatureMired,
    minTemperatureMired,
    maxTemperatureMired
  );

  if (clampedLevel <= 0) {
    return {
      warmLevel: 0,
      coldLevel: 0,
      redLevel: 0,
      greenLevel: 0,
      blueLevel: 0
    };
  }

  const dominant = Math.max(warmRatio, 1 - warmRatio);

  return {
    warmLevel: clampByte((clampedLevel * warmRatio) / dominant),
    coldLevel: clampByte((clampedLevel * (1 - warmRatio)) / dominant),
    redLevel: 0,
    greenLevel: 0,
    blueLevel: 0
  };
}

function deriveDisplayState(
  channels: LightChannels,
  fallbackTemperatureMired: number,
  minTemperatureMired: number,
  maxTemperatureMired: number
) {
  const level = Math.max(channels.warmLevel, channels.coldLevel);
  const totalWhite = channels.warmLevel + channels.coldLevel;

  if (totalWhite === 0) {
    return {
      level,
      temperatureMired: fallbackTemperatureMired
    };
  }

  const warmRatio = channels.warmLevel / totalWhite;

  return {
    level,
    temperatureMired: Math.round(
      minTemperatureMired +
        warmRatio * (maxTemperatureMired - minTemperatureMired)
    )
  };
}

function getWarmRatio(
  temperatureMired: number,
  minTemperatureMired: number,
  maxTemperatureMired: number
) {
  if (maxTemperatureMired === minTemperatureMired) return 0;

  return clamp(
    (temperatureMired - minTemperatureMired) /
      (maxTemperatureMired - minTemperatureMired),
    0,
    1
  );
}

function isByte(value: unknown) {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 255
  );
}

function isTransitionMs(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 65_535
  );
}

function clampByte(value: number) {
  return clamp(Math.round(value), 0, 255);
}

function clampTransitionMs(value: number) {
  return clamp(Math.round(value), 0, 65_535);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
