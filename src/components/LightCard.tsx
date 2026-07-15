import { useEffect, useRef, useState } from 'preact/hooks';
import {
  BUS_DESTINATION_BROADCAST,
  SIMULATOR_BOARD_ID,
  type BusEntityId
} from '../bus/base-protocol';
import type { Bus } from '../bus/bus';
import {
  LIGHT_CAPABILITY_TRANSITION,
  LIGHT_CHANNEL_BLUE,
  LIGHT_CHANNEL_COLD,
  LIGHT_CHANNEL_GREEN,
  LIGHT_CHANNEL_MASK,
  LIGHT_CHANNEL_RED,
  LIGHT_CHANNEL_WARM,
  LIGHT_GROUP_ID,
  LIGHT_RESULT_OK,
  LIGHT_RESULT_STATE_CHANGED,
  LIGHT_SET_REQUEST,
  LIGHT_STATE,
  LIGHT_STATE_REQUEST,
  type LightSetRequest,
  type LightState
} from '../bus/light-protocol';
import { AppButton } from './AppButton';
import { DeviceCard } from './DeviceCard';
import { GlowingLightPreview } from './GlowingLightPreview';

export type LightCardProps = {
  id: string;
  entityId: BusEntityId;
  title: string;
  bus: Bus;
  minLevel: number;
  maxLevel: number;
  minTemperatureMired: number;
  maxTemperatureMired: number;
};

const stateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

type LightChannelControl = {
  bit: number;
  key: keyof Pick<
    LightState,
    'warmLevel' | 'coldLevel' | 'redLevel' | 'greenLevel' | 'blueLevel'
  >;
  label: string;
};

const lightChannels: LightChannelControl[] = [
  { bit: LIGHT_CHANNEL_WARM, key: 'warmLevel', label: 'Warm' },
  { bit: LIGHT_CHANNEL_COLD, key: 'coldLevel', label: 'Cold' },
  { bit: LIGHT_CHANNEL_RED, key: 'redLevel', label: 'Red' },
  { bit: LIGHT_CHANNEL_GREEN, key: 'greenLevel', label: 'Green' },
  { bit: LIGHT_CHANNEL_BLUE, key: 'blueLevel', label: 'Blue' }
];

type LightDisplayState = {
  level: number;
  temperatureMired: number;
};

export function LightCard({
  id,
  entityId,
  title,
  bus,
  minLevel,
  maxLevel,
  minTemperatureMired,
  maxTemperatureMired
}: LightCardProps) {
  const [state, setState] = useState<LightState | null>(null);
  const [transitionMs, setTransitionMs] = useState(0);
  const transitionMsRef = useRef(0);
  const lastOnLevelsRef = useRef(createEmptyLevels());

  useEffect(() => {
    const unsubscribe = bus.listen((message) => {
      if (message.group !== LIGHT_GROUP_ID || message.type !== LIGHT_STATE) {
        return;
      }

      const payload = message.payload as Partial<LightState> | undefined;
      if (!payload || payload.id !== entityId) return;

      if (
        payload.result !== LIGHT_RESULT_OK &&
        payload.result !== LIGHT_RESULT_STATE_CHANGED
      ) return;

      setState(payload as LightState);
    });

    bus.send({
      destination: BUS_DESTINATION_BROADCAST,
      group: LIGHT_GROUP_ID,
      type: LIGHT_STATE_REQUEST,
      payload: { id: entityId }
    });

    return unsubscribe;
  }, [bus, entityId]);

  const display = deriveDisplayState(
    state,
    minTemperatureMired,
    maxTemperatureMired
  );
  const animatedDisplay = useAnimatedLightDisplay(
    display,
    state?.transitionMs ?? 0
  );
  const changedAt =
    state?.timestampMs === undefined || state.timestampMs === 0
      ? 'Unknown'
      : stateTimeFormatter.format(new Date(state.timestampMs));
  const supportedChannels = getSupportedChannels(state);
  const canControl = state !== null && supportedChannels.length > 0;
  const supportsTransition = Boolean(
    state && (state.capabilities & LIGHT_CAPABILITY_TRANSITION)
  );

  useEffect(() => {
    if (!state || !hasAnyOutput(state)) return;

    lastOnLevelsRef.current = pickLevels(state);
  }, [state]);

  function sendLightSet(
    channels: number,
    levels: Partial<LightSetRequest>
  ) {
    if (!state) return;

    bus.send<LightSetRequest>({
      destination: SIMULATOR_BOARD_ID,
      group: LIGHT_GROUP_ID,
      type: LIGHT_SET_REQUEST,
      payload: {
        id: entityId,
        channels,
        warmLevel: levels.warmLevel ?? 0,
        coldLevel: levels.coldLevel ?? 0,
        redLevel: levels.redLevel ?? 0,
        greenLevel: levels.greenLevel ?? 0,
        blueLevel: levels.blueLevel ?? 0,
        transitionMs: supportsTransition ? transitionMsRef.current : 0
      }
    });
  }

  function updateTransitionMs(nextTransitionMs: number) {
    const clampedTransitionMs = clampTransitionMs(nextTransitionMs);

    transitionMsRef.current = clampedTransitionMs;
    setTransitionMs(clampedTransitionMs);
  }

  function setChannel(channel: LightChannelControl, level: number) {
    sendLightSet(channel.bit, {
      [channel.key]: clampByte(level)
    });
  }

  function turnOff() {
    sendLightSet(getSupportedChannelMask(state), createEmptyLevels());
  }

  function turnOn() {
    const previous = lastOnLevelsRef.current;
    const fallback = createDefaultOnLevels(getSupportedChannelMask(state));
    const levels = hasAnyLevel(previous) ? previous : fallback;

    sendLightSet(getSupportedChannelMask(state), levels);
  }

  return (
    <DeviceCard className="light-card">
      <header class="light-card__header">
        <h2>{title}</h2>
        <dl class="sensor-fields">
          <div>
            <dt>Id:</dt>
            <dd>{id}</dd>
          </div>
          <div>
            <dt>Changed at:</dt>
            <dd>{changedAt}</dd>
          </div>
        </dl>
      </header>

      <div class="light-card__scene" aria-label={`${id} light preview`}>
        <GlowingLightPreview
          level={animatedDisplay.level}
          minLevel={minLevel}
          maxLevel={maxLevel}
          temperatureMired={animatedDisplay.temperatureMired}
        />
      </div>

      {canControl && (
        <div class="light-card__controls" aria-label={`${id} light controls`}>
          {supportedChannels.map((channel) => (
            <label class="light-card__slider" key={channel.key}>
              <span>
                {channel.label} {state[channel.key]}
              </span>
              <input
                type="range"
                min="0"
                max="255"
                step="1"
                value={state[channel.key]}
                onInput={(event) =>
                  setChannel(channel, Number(event.currentTarget.value))
                }
              />
            </label>
          ))}

          {supportsTransition && (
            <label class="light-card__slider">
              <span>Transition {formatTransitionMs(transitionMs)}</span>
              <input
                type="range"
                min="0"
                max="65535"
                step="250"
                value={transitionMs}
                onInput={(event) =>
                  updateTransitionMs(Number(event.currentTarget.value))
                }
              />
            </label>
          )}

          <div class="light-card__button-row">
            <AppButton label="On" onClick={turnOn} variant="primary" />
            <AppButton label="Off" onClick={turnOff} variant="ghost" />
          </div>
        </div>
      )}
    </DeviceCard>
  );
}

function deriveDisplayState(
  state: LightState | null,
  minTemperatureMired: number,
  maxTemperatureMired: number
): LightDisplayState {
  if (!state) {
    return {
      level: 0,
      temperatureMired: Math.round((minTemperatureMired + maxTemperatureMired) / 2)
    };
  }

  const level = Math.max(state.warmLevel, state.coldLevel);
  const totalWhite = state.warmLevel + state.coldLevel;

  if (totalWhite === 0) {
    return {
      level,
      temperatureMired: Math.round((minTemperatureMired + maxTemperatureMired) / 2)
    };
  }

  const warmRatio = state.warmLevel / totalWhite;

  return {
    level,
    temperatureMired: Math.round(
      minTemperatureMired +
        warmRatio * (maxTemperatureMired - minTemperatureMired)
    )
  };
}

function useAnimatedLightDisplay(
  target: LightDisplayState,
  transitionMs: number
) {
  const [animated, setAnimated] = useState(target);
  const animatedRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const durationMs = clampTransitionMs(transitionMs);

    if (durationMs === 0) {
      animatedRef.current = target;
      setAnimated(target);
      return;
    }

    const start = animatedRef.current;
    const startedAt = performance.now();

    function tick(now: number) {
      const progress = Math.min(Math.max((now - startedAt) / durationMs, 0), 1);
      const easedProgress = smoothStep(progress);
      const next = {
        level: interpolate(start.level, target.level, easedProgress),
        temperatureMired: interpolate(
          start.temperatureMired,
          target.temperatureMired,
          easedProgress
        )
      };

      animatedRef.current = next;
      setAnimated(next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target.level, target.temperatureMired, transitionMs]);

  return animated;
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function smoothStep(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

function getSupportedChannels(state: LightState | null) {
  if (!state) return [];

  return lightChannels.filter((channel) => Boolean(state.capabilities & channel.bit));
}

function getSupportedChannelMask(state: LightState | null) {
  if (!state) return 0;

  return state.capabilities & LIGHT_CHANNEL_MASK;
}

function pickLevels(state: LightState) {
  return {
    warmLevel: state.warmLevel,
    coldLevel: state.coldLevel,
    redLevel: state.redLevel,
    greenLevel: state.greenLevel,
    blueLevel: state.blueLevel
  };
}

function createEmptyLevels() {
  return {
    warmLevel: 0,
    coldLevel: 0,
    redLevel: 0,
    greenLevel: 0,
    blueLevel: 0
  };
}

function createDefaultOnLevels(channelMask: number) {
  return {
    warmLevel: channelMask & LIGHT_CHANNEL_WARM ? 180 : 0,
    coldLevel: channelMask & LIGHT_CHANNEL_COLD ? 90 : 0,
    redLevel: channelMask & LIGHT_CHANNEL_RED ? 180 : 0,
    greenLevel: channelMask & LIGHT_CHANNEL_GREEN ? 180 : 0,
    blueLevel: channelMask & LIGHT_CHANNEL_BLUE ? 180 : 0
  };
}

function hasAnyOutput(state: LightState) {
  return hasAnyLevel(pickLevels(state));
}

function hasAnyLevel(levels: ReturnType<typeof createEmptyLevels>) {
  return (
    levels.warmLevel > 0 ||
    levels.coldLevel > 0 ||
    levels.redLevel > 0 ||
    levels.greenLevel > 0 ||
    levels.blueLevel > 0
  );
}

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampTransitionMs(value: number) {
  return Math.min(65_535, Math.max(0, Math.round(value)));
}

function formatTransitionMs(milliseconds: number) {
  if (milliseconds < 1_000) return `${milliseconds}ms`;

  return `${(milliseconds / 1_000).toFixed(milliseconds % 1_000 === 0 ? 0 : 2)}s`;
}
