import { SIMULATOR_BOARD_ID } from '../bus/base-protocol';
import {
  BINARY_SENSOR_GROUP_ID,
  BINARY_SENSOR_RESULT_STATE_CHANGED,
  BINARY_SENSOR_STATE,
  type BinarySensorState
} from '../bus/binary-sensor-protocol';
import type { Bus, BusRawMessage } from '../bus/bus';
import {
  BUTTON_ACTION,
  BUTTON_ACTION_DOUBLE_CLICK,
  BUTTON_ACTION_HOLD_START,
  BUTTON_ACTION_SINGLE_CLICK,
  BUTTON_GROUP_ID,
  type ButtonActionMessage
} from '../bus/button-protocol';
import {
  LIGHT_CHANNEL_COLD,
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
import {
  NUMERIC_SENSOR_GROUP_ID,
  NUMERIC_SENSOR_RESULT_STATE_CHANGED,
  NUMERIC_SENSOR_STATE,
  type NumericSensorState
} from '../bus/numeric-sensor-protocol';
import {
  SYSTEM_GROUP_ID,
  SYSTEM_TIMER_CANCEL_REQUEST,
  SYSTEM_TIMER_EVENT,
  SYSTEM_TIMER_EVENT_REASON_EXPIRED,
  SYSTEM_TIMER_RESULT_OK,
  SYSTEM_TIMER_START_REQUEST,
  SYSTEM_TIMER_START_RESPONSE,
  type SystemTimerCancelRequest,
  type SystemTimerEvent,
  type SystemTimerStartResponse,
  type SystemTimerStartRequest
} from '../bus/timer-protocol';
import {
  kitchenAutomationConfig,
  kitchenEntityIds,
  kitchenLightGroup,
  kitchenLights,
  kitchenTimerIds,
  kitchenZones,
  type KitchenZoneId
} from './kitchen-entities';

export const LightingMode = {
  Off: 'Off',
  Ambient: 'Ambient',
  Adaptive: 'Adaptive',
  ManualWarm: 'ManualWarm',
  ManualBright: 'ManualBright',
  ForcedBright: 'ForcedBright'
} as const;

type LightingMode = (typeof LightingMode)[keyof typeof LightingMode];

type LightingScene = {
  brightness: number;
  temperature: number;
};

type SceneLightingMode =
  | typeof LightingMode.Adaptive
  | typeof LightingMode.ManualWarm
  | typeof LightingMode.ManualBright
  | typeof LightingMode.ForcedBright;

type DesiredLightStateSource = 'automation' | 'manual';

type DesiredLightState =
  | {
      kind: 'scene';
      mode: SceneLightingMode;
      scene: LightingScene;
      lux?: number;
      reason: string;
      applyReason: string;
      source: DesiredLightStateSource;
      force?: boolean;
    }
  | {
      kind: 'ambient' | 'off';
      reason: string;
      source: DesiredLightStateSource;
      force?: boolean;
    };

type ActiveDowngradeBlock = {
  key: string;
  reason: string;
};

type LightStateBlocker =
  | { type: 'manualOverride' }
  | { type: 'lowerLuxHeld'; lux: number; appliedSceneLux: number }
  | { type: 'downgradeHold'; key: string; until: number }
  | { type: 'minimumSceneUpdateInterval' }
  | { type: 'satisfied' };

type ZoneState = {
  lux: number | null;
  syntheticLux: boolean;
  lastLuxAt: number;
  lastMotionAt: number;
  pendingLux: boolean;
  fallbackRevision: number;
  fallbackTimerId: string;
};

type KnownLightState = {
  on: boolean;
  updatedAt: number;
};

type AutomationEvent = {
  at: number;
  type: string;
  data?: Record<string, unknown>;
};

type KitchenLightingAutomationInput = {
  getTimeMs: () => number;
};

const WHITE_CHANNELS = LIGHT_CHANNEL_WARM | LIGHT_CHANNEL_COLD;

export class KitchenLightingAutomationRuntime {
  readonly events: AutomationEvent[] = [];

  private bus: Bus | null = null;
  private mode: LightingMode = LightingMode.Off;
  private scene: LightingScene | null = null;
  private appliedSceneLux = -1;
  private lastSceneAppliedAt = Number.NEGATIVE_INFINITY;
  private desiredLightState: DesiredLightState | null = null;
  private activeDowngradeBlock: ActiveDowngradeBlock | null = null;
  private downgradeTimerUntil = 0;
  private downgradeTimerGeneration = 0;
  private manualOverrideUntil = 0;
  private manualOverrideGeneration = 0;
  private ambientEligible = false;
  private startupLightCheckRunning = false;
  private startupLightCheckFinished = false;
  private startupLightCheckGeneration = 0;
  private readonly knownLightStates = new Map<number, KnownLightState>();
  private readonly zones = new Map<KitchenZoneId, ZoneState>();
  private readonly getTimeMs: () => number;

  constructor({ getTimeMs }: KitchenLightingAutomationInput) {
    this.getTimeMs = getTimeMs;

    for (const zone of kitchenZones) {
      this.zones.set(zone.id, {
        lux: null,
        syntheticLux: false,
        lastLuxAt: Number.NEGATIVE_INFINITY,
        lastMotionAt: Number.NEGATIVE_INFINITY,
        pendingLux: false,
        fallbackRevision: 0,
        fallbackTimerId: zone.fallbackTimerId
      });
    }
  }

  connect(bus: Bus) {
    this.bus = bus;

    const unsubscribe = bus.listen((message) => this.handleBusMessage(message));
    queueMicrotask(() => this.startStartupLightStateCheck());

    return unsubscribe;
  }

  getSnapshot() {
    return {
      mode: this.mode,
      scene: this.scene,
      appliedSceneLux: this.appliedSceneLux,
      ambientEligible: this.ambientEligible,
      manualOverrideUntil: this.manualOverrideUntil,
      downgradeTimerUntil: this.downgradeTimerUntil,
      desiredLightState: this.desiredLightState,
      startupLightCheckRunning: this.startupLightCheckRunning,
      startupLightCheckFinished: this.startupLightCheckFinished,
      knownLightStates: Object.fromEntries(this.knownLightStates),
      zones: Object.fromEntries(this.zones)
    };
  }

  private handleBusMessage(message: BusRawMessage) {
    if (message.group === BINARY_SENSOR_GROUP_ID && message.type === BINARY_SENSOR_STATE) {
      this.handleBinarySensorState(message.payload as Partial<BinarySensorState> | undefined);
      return;
    }

    if (message.group === NUMERIC_SENSOR_GROUP_ID && message.type === NUMERIC_SENSOR_STATE) {
      this.handleNumericSensorState(message.payload as Partial<NumericSensorState> | undefined);
      return;
    }

    if (message.group === BUTTON_GROUP_ID && message.type === BUTTON_ACTION) {
      this.handleButtonAction(message.payload as Partial<ButtonActionMessage> | undefined);
      return;
    }

    if (message.group === LIGHT_GROUP_ID && message.type === LIGHT_STATE) {
      this.handleLightState(message.payload as Partial<LightState> | undefined);
      return;
    }

    if (message.group === SYSTEM_GROUP_ID && message.type === SYSTEM_TIMER_EVENT) {
      this.handleTimerEvent(message.payload as Partial<SystemTimerEvent> | undefined);
      return;
    }

    if (
      message.group === SYSTEM_GROUP_ID &&
      message.type === SYSTEM_TIMER_START_RESPONSE
    ) {
      this.handleTimerStartResponse(
        message.payload as Partial<SystemTimerStartResponse> | undefined
      );
    }
  }

  private handleBinarySensorState(payload: Partial<BinarySensorState> | undefined) {
    if (
      !payload ||
      payload.result !== BINARY_SENSOR_RESULT_STATE_CHANGED ||
      payload.value === 0
    ) return;

    const zone = kitchenZones.find(
      (item) => kitchenEntityIds[item.motionKey] === payload.id
    );
    if (!zone) return;

    this.motion(zone.id);
  }

  private handleNumericSensorState(payload: Partial<NumericSensorState> | undefined) {
    if (
      !payload ||
      payload.result !== NUMERIC_SENSOR_RESULT_STATE_CHANGED ||
      typeof payload.rawValue !== 'number' ||
      typeof payload.scale !== 'number'
    ) return;

    const zone = kitchenZones.find(
      (item) => kitchenEntityIds[item.illuminanceKey] === payload.id
    );
    if (!zone) return;

    this.illuminance(zone.id, payload.rawValue * 10 ** payload.scale);
  }

  private handleButtonAction(payload: Partial<ButtonActionMessage> | undefined) {
    if (!payload || payload.id !== kitchenEntityIds.masterButton) return;

    if (payload.action === BUTTON_ACTION_SINGLE_CLICK) {
      this.button('click');
      return;
    }

    if (payload.action === BUTTON_ACTION_DOUBLE_CLICK) {
      this.button('doubleClick');
      return;
    }

    if (payload.action === BUTTON_ACTION_HOLD_START) {
      this.button('press');
    }
  }

  private handleLightState(payload: Partial<LightState> | undefined) {
    if (
      !payload ||
      (payload.result !== LIGHT_RESULT_OK &&
        payload.result !== LIGHT_RESULT_STATE_CHANGED)
    ) return;

    const entityId = payload.id;
    const isKitchenLight =
      typeof entityId === 'number' &&
      kitchenLights.some((light) => light.entityId === entityId);
    if (isKitchenLight) {
      this.knownLightStates.set(entityId, {
        on: isLightStateOn(payload),
        updatedAt: this.now()
      });
      this.reconcilePhysicalLightState(entityId);
    }

    if (
      !this.startupLightCheckRunning ||
      !isKitchenLight
    ) return;

    if (!isLightStateOn(payload)) return;

    this.startupLightCheckRunning = false;
    this.startupLightCheckFinished = true;
    this.sendTimerCancel(kitchenTimerIds.startupLightCheck);
    this.record('startupLightCheckDetectedActiveLight', { id: payload.id });
  }

  private handleTimerEvent(payload: Partial<SystemTimerEvent> | undefined) {
    if (
      !payload ||
      payload.board !== SIMULATOR_BOARD_ID ||
      payload.reason !== SYSTEM_TIMER_EVENT_REASON_EXPIRED
    ) return;

    if (payload.timerId === kitchenTimerIds.manualOverride) {
      if (payload.generation !== this.manualOverrideGeneration) return;

      this.manualOverrideUntil = 0;
      this.record('manualOverrideExpired');
      this.releaseManualModeToAdaptive('manual-override-expired');
      this.tryApplyDesiredLightState('manual-override-expired');
      return;
    }

    if (payload.timerId === kitchenTimerIds.downgradeHold) {
      this.deliverDowngradeTimerExpired(payload.generation ?? 0);
      return;
    }

    if (payload.timerId === kitchenTimerIds.startupLightCheck) {
      if (payload.generation !== this.startupLightCheckGeneration) return;

      this.startupLightCheckRunning = false;
      this.startupLightCheckFinished = true;
      this.record('startupLightCheckExpired');
      return;
    }

    const zone = kitchenZones.find((item) => item.fallbackTimerId === payload.timerId);
    if (zone) {
      this.deliverFallbackExpired(zone.id, payload.generation ?? 0);
    }
  }

  private handleTimerStartResponse(
    payload: Partial<SystemTimerStartResponse> | undefined
  ) {
    if (
      !payload ||
      payload.board !== SIMULATOR_BOARD_ID ||
      payload.result !== SYSTEM_TIMER_RESULT_OK ||
      typeof payload.generation !== 'number'
    ) return;

    if (
      payload.timerId === kitchenTimerIds.manualOverride &&
      this.manualOverrideUntil > 0
    ) {
      this.manualOverrideGeneration = payload.generation;
      return;
    }

    if (
      payload.timerId === kitchenTimerIds.downgradeHold &&
      this.downgradeTimerUntil > 0
    ) {
      this.downgradeTimerGeneration = payload.generation;
      return;
    }

    if (
      payload.timerId === kitchenTimerIds.startupLightCheck &&
      this.startupLightCheckRunning
    ) {
      this.startupLightCheckGeneration = payload.generation;
      return;
    }

    const zone = [...this.zones.values()].find(
      (item) => item.pendingLux && item.fallbackTimerId === payload.timerId
    );
    if (zone) {
      zone.fallbackRevision = payload.generation;
    }
  }

  private motion(zoneName: KitchenZoneId) {
    const zone = this.zone(zoneName);
    zone.lastMotionAt = this.now();
    this.record('motion', { zone: zoneName });

    if (this.isManualOverrideActive()) {
      this.record('motionIgnoredByManualOverride', { zone: zoneName });
    }

    if (this.isLuxFresh(zone)) {
      this.cancelFallbackTimer(zoneName, 'fresh-lux-at-motion');
      this.applyAdaptiveCandidate('motion');
      return;
    }

    this.startFallbackTimer(zoneName, 'motion-without-fresh-lux');
  }

  private illuminance(zoneName: KitchenZoneId, lux: number) {
    const zone = this.zone(zoneName);
    zone.lux = clamp(Math.round(lux), 0, 65_535);
    zone.syntheticLux = false;
    zone.lastLuxAt = this.now();
    this.record('lux', { zone: zoneName, lux: zone.lux });

    this.updateAmbientEligibility();

    if (zone.pendingLux) {
      this.cancelFallbackTimer(zoneName, 'lux-arrived');
      this.applyAdaptiveCandidate('motion-lux');
      return;
    }

    if (this.isManualOverrideActive()) {
      this.record('luxIgnoredByManualOverride', { zone: zoneName });
    }

    if (this.mode === LightingMode.Off && this.ambientEligible) {
      this.applyAmbient('low-lux-while-off');
      return;
    }

    if (this.mode === LightingMode.Adaptive || this.isManualOverrideActive()) {
      this.applyAdaptiveCandidate('lux-update');
    }
  }

  private deliverFallbackExpired(zoneName: KitchenZoneId, generation: number) {
    const zone = this.zone(zoneName);

    if (!zone.pendingLux || generation !== zone.fallbackRevision) {
      this.record('staleFallbackExpiredIgnored', {
        zone: zoneName,
        generation,
        currentGeneration: zone.fallbackRevision
      });
      return;
    }

    zone.pendingLux = false;
    zone.lux = kitchenAutomationConfig.fallbackLux;
    zone.syntheticLux = true;
    zone.lastLuxAt = this.now();
    this.record('fallbackLux', {
      zone: zoneName,
      lux: zone.lux,
      generation
    });

    this.applyAdaptiveCandidate('motion-fallback-lux');
  }

  private button(action: 'click' | 'press' | 'doubleClick') {
    this.startManualOverride(action);

    if (action === 'click') {
      if (this.shouldClickTurnLightingOff()) {
        if (this.ambientEligible) {
          this.applyAmbient('button-click-off-to-ambient', 'manual', true);
        } else {
          this.applyOff('button-click-off', 'manual', true);
        }
        return;
      }

      this.applyAdaptiveCandidate('button-click-on', 'manual', true);
      return;
    }

    if (action === 'press') {
      if (
        this.mode === LightingMode.Off ||
        this.mode === LightingMode.Ambient ||
        this.closestBoundary() === 'bright'
      ) {
        this.applyManualWarm('button-press-warm');
      } else {
        this.applyManualBright('button-press-bright');
      }
      return;
    }

    this.applyForcedBright('button-double-click');
  }

  private deliverDowngradeTimerExpired(generation: number) {
    if (
      generation !== this.downgradeTimerGeneration ||
      this.activeDowngradeBlock === null
    ) {
      this.record('staleDowngradeTimerExpiredIgnored', {
        generation,
        currentGeneration: this.downgradeTimerGeneration
      });
      return;
    }

    this.downgradeTimerUntil = 0;
    this.record('downgradeTimerExpired', {
      generation,
      desired: this.desiredLightState ?? undefined,
      reason: this.activeDowngradeBlock.reason
    });

    this.tryApplyDesiredLightState('downgrade-timer-expired');
  }

  private applyAdaptiveCandidate(
    reason: string,
    source: DesiredLightStateSource = 'automation',
    force = false
  ) {
    const lux = this.effectiveLux();
    const candidate = sceneForLux(lux);
    this.requestLightState({
      kind: 'scene',
      mode: LightingMode.Adaptive,
      scene: candidate,
      lux,
      reason,
      applyReason: `${reason}:lux=${lux}`,
      source,
      force
    });
  }

  private requestLightState(desired: DesiredLightState) {
    this.desiredLightState = cloneDesiredLightState(desired);
    this.record('lightStateDesired', { desired: this.desiredLightState });
    this.tryApplyDesiredLightState(desired.reason);
  }

  private tryApplyDesiredLightState(trigger: string) {
    const desired = this.desiredLightState;
    if (desired === null) return false;

    if (desired.force) {
      this.clearPendingDowngrade();
    }

    const blocker = this.findLightStateBlocker(desired);
    if (blocker?.type === 'satisfied') {
      this.record('lightStateAlreadySatisfied', { desired, trigger });
      this.desiredLightState = null;
      return true;
    }

    if (blocker) {
      this.record('lightStateHeld', { desired, blocker, trigger });
      if (desired.kind === 'scene') {
        this.record('sceneHeld', {
          reason: desired.reason,
          candidate: desired.scene,
          current: this.scene ?? undefined,
          blocker
        });
      }
      return false;
    }

    this.applyLightStateNow(desired);
    return true;
  }

  private findLightStateBlocker(desired: DesiredLightState): LightStateBlocker | null {
    if (desired.source === 'automation' && this.isManualOverrideActive()) {
      return { type: 'manualOverride' };
    }

    if (desired.kind !== 'scene') {
      this.clearPendingDowngrade();
      return null;
    }

    return this.findSceneBlocker(desired);
  }

  private findSceneBlocker(
    desired: Extract<DesiredLightState, { kind: 'scene' }>
  ): LightStateBlocker | null {
    if (
      !desired.force &&
      desired.source === 'automation' &&
      desired.lux !== undefined &&
      this.appliedSceneLux >= 0 &&
      desired.lux < this.appliedSceneLux
    ) {
      this.clearPendingDowngrade();
      return {
        type: 'lowerLuxHeld',
        lux: desired.lux,
        appliedSceneLux: this.appliedSceneLux
      };
    }

    if (
      desired.force ||
      this.mode === LightingMode.Off ||
      this.mode === LightingMode.Ambient ||
      this.scene === null
    ) {
      this.clearPendingDowngrade();
      return null;
    }

    if (
      scenesEqual(desired.scene, this.scene) ||
      isInsideDeadband(desired.scene, this.scene)
    ) {
      this.clearPendingDowngrade();
      return { type: 'satisfied' };
    }

    const insideMinimumInterval =
      this.now() - this.lastSceneAppliedAt <
      kitchenAutomationConfig.minimumSceneUpdateIntervalMs;

    if (isUpgrade(desired.scene, this.scene)) {
      this.clearPendingDowngrade();
      return null;
    }

    if (!isDowngrade(desired.scene, this.scene)) {
      this.clearPendingDowngrade();
      return insideMinimumInterval
        ? { type: 'minimumSceneUpdateInterval' }
        : null;
    }

    const key = sceneKey(desired.scene);
    if (this.activeDowngradeBlock?.key !== key) {
      this.startDowngradeTimer({ key, reason: desired.reason });
      return {
        type: 'downgradeHold',
        key,
        until: this.downgradeTimerUntil
      };
    }

    if (this.downgradeTimerUntil > this.now()) {
      return {
        type: 'downgradeHold',
        key,
        until: this.downgradeTimerUntil
      };
    }

    return insideMinimumInterval
      ? { type: 'minimumSceneUpdateInterval' }
      : null;
  }

  private applyLightStateNow(desired: DesiredLightState) {
    if (desired.kind === 'scene') {
      this.applySceneNow(desired.mode, desired.scene, desired.applyReason, desired.lux);
      return;
    }

    if (desired.kind === 'ambient') {
      this.applyAmbientNow(desired.reason);
      return;
    }

    this.applyOffNow(desired.reason);
  }

  private effectiveLux() {
    const activeZone = this.mostRecentActiveZoneWithFreshLux();
    if (activeZone !== null) return activeZone.lux ?? kitchenAutomationConfig.fallbackLux;

    const freshLux = [...this.zones.values()]
      .filter((zone) => this.isRealLuxFresh(zone))
      .map((zone) => zone.lux)
      .filter((lux): lux is number => lux !== null)
      .sort((left, right) => left - right);

    if (freshLux.length === 0) return kitchenAutomationConfig.fallbackLux;

    return freshLux[Math.floor(freshLux.length / 2)];
  }

  private mostRecentActiveZoneWithFreshLux() {
    let best: ZoneState | null = null;

    for (const zone of this.zones.values()) {
      if (!this.isMotionRecent(zone) || !this.isLuxFresh(zone)) continue;
      if (best === null || zone.lastMotionAt > best.lastMotionAt) {
        best = zone;
      }
    }

    return best;
  }

  private updateAmbientEligibility() {
    const fresh = [...this.zones.values()].filter((zone) =>
      this.isRealLuxFresh(zone)
    );
    if (fresh.length === 0) return;

    if (fresh.some((zone) => (zone.lux ?? 0) <= kitchenAutomationConfig.ambientOnLux)) {
      this.ambientEligible = true;
      this.record('ambientEligible', { value: true });
      return;
    }

    if (fresh.every((zone) => (zone.lux ?? 0) >= kitchenAutomationConfig.ambientOffLux)) {
      this.ambientEligible = false;
      this.record('ambientEligible', { value: false });
    }
  }

  private applyScene(
    mode: SceneLightingMode,
    scene: LightingScene,
    reason: string,
    source: DesiredLightStateSource = 'automation',
    force = false
  ) {
    this.requestLightState({
      kind: 'scene',
      mode,
      scene,
      reason,
      applyReason: reason,
      source,
      force
    });
  }

  private applySceneNow(
    mode: SceneLightingMode,
    scene: LightingScene,
    reason: string,
    lux?: number
  ) {
    this.mode = mode;
    this.scene = { ...scene };
    if (lux !== undefined) {
      this.appliedSceneLux = lux;
    }
    this.lastSceneAppliedAt = this.now();
    this.clearPendingDowngrade();
    this.desiredLightState = null;
    this.sendLightLevel(
      brightnessPercentToLevel(scene.brightness),
      scene.temperature
    );
    this.record('sceneApplied', { mode, scene: this.scene, reason });
  }

  private applyManualWarm(reason: string) {
    this.applyScene(
      LightingMode.ManualWarm,
      {
        brightness: kitchenAutomationConfig.minBrightness,
        temperature: kitchenAutomationConfig.warmMireds
      },
      reason,
      'manual',
      true
    );
  }

  private applyManualBright(reason: string) {
    this.applyScene(
      LightingMode.ManualBright,
      {
        brightness: kitchenAutomationConfig.maxBrightness,
        temperature: kitchenAutomationConfig.neutralMireds
      },
      reason,
      'manual',
      true
    );
  }

  private applyForcedBright(reason: string) {
    this.applyScene(
      LightingMode.ForcedBright,
      {
        brightness: kitchenAutomationConfig.maxBrightness,
        temperature: kitchenAutomationConfig.neutralMireds
      },
      reason,
      'manual',
      true
    );
  }

  private applyAmbient(
    reason: string,
    source: DesiredLightStateSource = 'automation',
    force = false
  ) {
    this.requestLightState({
      kind: 'ambient',
      reason,
      source,
      force
    });
  }

  private applyAmbientNow(reason: string) {
    this.mode = LightingMode.Ambient;
    this.scene = null;
    this.clearPendingDowngrade();
    this.desiredLightState = null;
    this.sendLightLevel(
      kitchenAutomationConfig.ambientBrightnessLevel,
      kitchenAutomationConfig.warmMireds
    );
    this.record('ambientApplied', { reason });
  }

  private applyOff(
    reason: string,
    source: DesiredLightStateSource = 'automation',
    force = false
  ) {
    this.requestLightState({
      kind: 'off',
      reason,
      source,
      force
    });
  }

  private applyOffNow(reason: string) {
    this.mode = LightingMode.Off;
    this.scene = null;
    this.appliedSceneLux = -1;
    this.clearPendingDowngrade();
    this.desiredLightState = null;
    this.sendLightLevel(0, kitchenAutomationConfig.warmMireds);
    this.record('offApplied', { reason });
  }

  private releaseManualModeToAdaptive(reason: string) {
    if (
      this.mode !== LightingMode.ManualWarm &&
      this.mode !== LightingMode.ManualBright &&
      this.mode !== LightingMode.ForcedBright
    ) return;

    this.mode = LightingMode.Adaptive;
    this.record('manualModeReleasedToAdaptive', {
      reason,
      scene: this.scene ?? undefined
    });
  }

  private startManualOverride(reason: string) {
    this.manualOverrideGeneration += 1;
    this.manualOverrideUntil =
      this.now() + kitchenAutomationConfig.manualOverrideMs;
    this.sendTimerStart(
      kitchenTimerIds.manualOverride,
      kitchenAutomationConfig.manualOverrideMs
    );
    this.record('manualOverrideStarted', {
      reason,
      until: this.manualOverrideUntil,
      generation: this.manualOverrideGeneration
    });
  }

  private closestBoundary() {
    if (this.scene === null) return 'warm';

    const warmDistance =
      Math.abs(this.scene.brightness - kitchenAutomationConfig.minBrightness) +
      Math.abs(this.scene.temperature - kitchenAutomationConfig.warmMireds) / 2;
    const brightDistance =
      Math.abs(this.scene.brightness - kitchenAutomationConfig.maxBrightness) +
      Math.abs(this.scene.temperature - kitchenAutomationConfig.neutralMireds) / 2;

    return brightDistance <= warmDistance ? 'bright' : 'warm';
  }

  private isManualOverrideActive() {
    return this.manualOverrideUntil > this.now();
  }

  private isMainLightMode() {
    return (
      this.mode === LightingMode.Adaptive ||
      this.mode === LightingMode.ManualWarm ||
      this.mode === LightingMode.ManualBright ||
      this.mode === LightingMode.ForcedBright
    );
  }

  private shouldClickTurnLightingOff() {
    const hasKnownState = this.hasKnownPhysicalLightState();
    const knownLightOn = this.isAnyKnownPhysicalLightOn();
    const controllerOnlyActive = this.isMainLightMode() && !hasKnownState;

    return knownLightOn || controllerOnlyActive;
  }

  private hasKnownPhysicalLightState() {
    return kitchenLights.some((light) =>
      this.knownLightStates.has(light.entityId)
    );
  }

  private isAnyKnownPhysicalLightOn() {
    return kitchenLights.some((light) =>
      this.knownLightStates.get(light.entityId)?.on === true
    );
  }

  private areAllPhysicalLightsKnownOff() {
    return kitchenLights.every((light) => {
      const state = this.knownLightStates.get(light.entityId);
      return state !== undefined && !state.on;
    });
  }

  private reconcilePhysicalLightState(entityId: number) {
    if (!this.isMainLightMode() || !this.areAllPhysicalLightsKnownOff()) return;

    this.mode = LightingMode.Off;
    this.scene = null;
    this.appliedSceneLux = -1;
    this.clearPendingDowngrade();
    this.desiredLightState = null;
    this.record('physicalLightsAllOff', { id: entityId });
  }

  private isLuxFresh(zone: ZoneState) {
    return (
      zone.lux !== null &&
      this.now() - zone.lastLuxAt <= kitchenAutomationConfig.readingFreshMs
    );
  }

  private isRealLuxFresh(zone: ZoneState) {
    return this.isLuxFresh(zone) && !zone.syntheticLux;
  }

  private isMotionRecent(zone: ZoneState) {
    return (
      this.now() - zone.lastMotionAt <= kitchenAutomationConfig.activeZoneHoldMs
    );
  }

  private startFallbackTimer(zoneName: KitchenZoneId, reason: string) {
    const zone = this.zone(zoneName);
    zone.pendingLux = true;
    zone.fallbackRevision += 1;
    this.sendTimerStart(
      zone.fallbackTimerId,
      kitchenAutomationConfig.fallbackTimeoutMs
    );
    this.record('luxRequested', {
      zone: zoneName,
      reason,
      generation: zone.fallbackRevision
    });
  }

  private cancelFallbackTimer(zoneName: KitchenZoneId, reason: string) {
    const zone = this.zone(zoneName);
    if (!zone.pendingLux) return;

    zone.pendingLux = false;
    this.sendTimerCancel(zone.fallbackTimerId);
    this.record('fallbackCancelled', {
      zone: zoneName,
      reason,
      generation: zone.fallbackRevision
    });
  }

  private startDowngradeTimer(activeDowngradeBlock: ActiveDowngradeBlock) {
    this.activeDowngradeBlock = activeDowngradeBlock;
    this.downgradeTimerGeneration += 1;
    this.downgradeTimerUntil =
      this.now() + kitchenAutomationConfig.downgradeHoldMs;
    this.sendTimerStart(
      kitchenTimerIds.downgradeHold,
      kitchenAutomationConfig.downgradeHoldMs
    );
    this.record('downgradeTimerStarted', {
      reason: activeDowngradeBlock.reason,
      desired: this.desiredLightState ?? undefined,
      until: this.downgradeTimerUntil,
      generation: this.downgradeTimerGeneration
    });
  }

  private clearPendingDowngrade() {
    const shouldCancelTimer =
      this.activeDowngradeBlock !== null && this.downgradeTimerUntil > this.now();

    this.activeDowngradeBlock = null;
    this.downgradeTimerUntil = 0;

    if (shouldCancelTimer) {
      this.sendTimerCancel(kitchenTimerIds.downgradeHold);
    }
  }

  private zone(zoneName: KitchenZoneId) {
    const zone = this.zones.get(zoneName);
    if (!zone) {
      throw new Error(`Unknown kitchen zone: ${zoneName}`);
    }
    return zone;
  }

  private sendTimerStart(timerId: string, timeoutMs: number) {
    this.bus?.send<SystemTimerStartRequest>({
      destination: SIMULATOR_BOARD_ID,
      group: SYSTEM_GROUP_ID,
      type: SYSTEM_TIMER_START_REQUEST,
      createdAtMs: this.now(),
      payload: {
        timerId,
        timeoutMs
      }
    });
  }

  private sendTimerCancel(timerId: string) {
    this.bus?.send<SystemTimerCancelRequest>({
      destination: SIMULATOR_BOARD_ID,
      group: SYSTEM_GROUP_ID,
      type: SYSTEM_TIMER_CANCEL_REQUEST,
      createdAtMs: this.now(),
      payload: { timerId }
    });
  }

  private startStartupLightStateCheck() {
    if (this.startupLightCheckRunning || this.startupLightCheckFinished) return;

    this.startupLightCheckRunning = true;
    this.startupLightCheckGeneration += 1;
    this.sendTimerStart(kitchenTimerIds.startupLightCheck, 3_000);

    for (const light of kitchenLights) {
      this.bus?.send({
        destination: SIMULATOR_BOARD_ID,
        group: LIGHT_GROUP_ID,
        type: LIGHT_STATE_REQUEST,
        createdAtMs: this.now(),
        payload: { id: light.entityId }
      });
    }

    this.record('startupLightCheckStarted');
  }

  private sendLightLevel(level: number, temperatureMired: number) {
    const channels = channelsFromLevelAndTemperature(level, temperatureMired);

    this.bus?.send<LightSetRequest>({
      destination: SIMULATOR_BOARD_ID,
      group: LIGHT_GROUP_ID,
      type: LIGHT_SET_REQUEST,
      createdAtMs: this.now(),
      payload: {
        id: kitchenLightGroup.entityId,
        channels: WHITE_CHANNELS,
        warmLevel: channels.warmLevel,
        coldLevel: channels.coldLevel,
        redLevel: 0,
        greenLevel: 0,
        blueLevel: 0,
        transitionMs: kitchenAutomationConfig.transitionMs
      }
    });
  }

  private record(type: string, data: Record<string, unknown> = {}) {
    const event = { at: this.now(), type, data };
    this.events.push(event);
    console.info(`[automation] ${type}`, event);
  }

  private now() {
    return this.getTimeMs();
  }
}

export function sceneForLux(lux: number): LightingScene {
  if (
    lux <= kitchenAutomationConfig.lowLux ||
    kitchenAutomationConfig.highLux <= kitchenAutomationConfig.lowLux
  ) {
    return {
      brightness: kitchenAutomationConfig.minBrightness,
      temperature: kitchenAutomationConfig.warmMireds
    };
  }

  if (lux >= kitchenAutomationConfig.highLux) {
    return {
      brightness: kitchenAutomationConfig.maxBrightness,
      temperature: kitchenAutomationConfig.neutralMireds
    };
  }

  const span = kitchenAutomationConfig.highLux - kitchenAutomationConfig.lowLux;
  const offset = lux - kitchenAutomationConfig.lowLux;
  const brightness =
    kitchenAutomationConfig.minBrightness +
    ((kitchenAutomationConfig.maxBrightness -
      kitchenAutomationConfig.minBrightness) *
      offset) /
      span;
  const temperature =
    kitchenAutomationConfig.warmMireds -
    ((kitchenAutomationConfig.warmMireds -
      kitchenAutomationConfig.neutralMireds) *
      offset) /
      span;

  return {
    brightness: Math.round(brightness),
    temperature: Math.round(temperature)
  };
}

function scenesEqual(left: LightingScene | null, right: LightingScene | null) {
  return (
    left !== null &&
    right !== null &&
    left.brightness === right.brightness &&
    left.temperature === right.temperature
  );
}

function isUpgrade(candidate: LightingScene, current: LightingScene) {
  return (
    candidate.brightness >=
      current.brightness + kitchenAutomationConfig.brightnessDeadband ||
    candidate.temperature <=
      current.temperature - kitchenAutomationConfig.temperatureDeadbandMireds
  );
}

function isDowngrade(candidate: LightingScene, current: LightingScene) {
  return (
    candidate.brightness <=
      current.brightness - kitchenAutomationConfig.brightnessDeadband ||
    candidate.temperature >=
      current.temperature + kitchenAutomationConfig.temperatureDeadbandMireds
  );
}

function isInsideDeadband(candidate: LightingScene, current: LightingScene) {
  return (
    Math.abs(candidate.brightness - current.brightness) <
      kitchenAutomationConfig.brightnessDeadband &&
    Math.abs(candidate.temperature - current.temperature) <
      kitchenAutomationConfig.temperatureDeadbandMireds
  );
}

function sceneKey(scene: LightingScene) {
  return `${scene.brightness}:${scene.temperature}`;
}

function cloneDesiredLightState(desired: DesiredLightState): DesiredLightState {
  if (desired.kind !== 'scene') {
    return { ...desired };
  }

  return {
    ...desired,
    scene: { ...desired.scene }
  };
}

function isLightStateOn(state: Partial<LightState>) {
  return (
    (state.warmLevel ?? 0) > 0 ||
    (state.coldLevel ?? 0) > 0 ||
    (state.redLevel ?? 0) > 0 ||
    (state.greenLevel ?? 0) > 0 ||
    (state.blueLevel ?? 0) > 0
  );
}

function brightnessPercentToLevel(percent: number) {
  if (percent >= 100) return 254;
  if (percent <= 0) return 0;

  return Math.max(1, Math.round((percent * 254) / 100));
}

function channelsFromLevelAndTemperature(level: number, temperatureMired: number) {
  const clampedLevel = clamp(Math.round(level), 0, 254);
  const warmRatio = clamp(
    (temperatureMired - kitchenAutomationConfig.minTemperatureMired) /
      (kitchenAutomationConfig.maxTemperatureMired -
        kitchenAutomationConfig.minTemperatureMired),
    0,
    1
  );

  if (clampedLevel <= 0) {
    return {
      warmLevel: 0,
      coldLevel: 0
    };
  }

  const dominant = Math.max(warmRatio, 1 - warmRatio);

  return {
    warmLevel: clamp(Math.round((clampedLevel * warmRatio) / dominant), 0, 255),
    coldLevel: clamp(Math.round((clampedLevel * (1 - warmRatio)) / dominant), 0, 255)
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
