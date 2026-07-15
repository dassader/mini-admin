import type { Bus } from '../bus/bus';
import type { BusEntityId } from '../bus/base-protocol';
import { VirtualDeviceEvents } from './virtual-device-events';
import { VirtualLight } from './VirtualLight';

type VirtualLightGroupOptions = {
  id: string;
  entityId: BusEntityId;
  members: VirtualLight[];
  initialLevel: number;
  initialTemperatureMired: number;
  minLevel: number;
  maxLevel: number;
  minTemperatureMired: number;
  maxTemperatureMired: number;
  getTimeMs: () => number;
};

export class VirtualLightGroup extends VirtualDeviceEvents {
  readonly id: string;
  readonly entityId: BusEntityId;
  readonly members: readonly VirtualLight[];
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly minTemperatureMired: number;
  readonly maxTemperatureMired: number;

  private readonly light: VirtualLight;
  private unsubscribeLight: (() => void) | null = null;

  constructor({
    id,
    entityId,
    members,
    initialLevel,
    initialTemperatureMired,
    minLevel,
    maxLevel,
    minTemperatureMired,
    maxTemperatureMired,
    getTimeMs
  }: VirtualLightGroupOptions) {
    super();
    this.id = id;
    this.entityId = entityId;
    this.members = members;
    this.minLevel = minLevel;
    this.maxLevel = maxLevel;
    this.minTemperatureMired = minTemperatureMired;
    this.maxTemperatureMired = maxTemperatureMired;
    this.light = new VirtualLight({
      id,
      entityId,
      initialLevel,
      initialTemperatureMired,
      minLevel,
      maxLevel,
      minTemperatureMired,
      maxTemperatureMired,
      getTimeMs
    });
  }

  connect(bus: Bus) {
    this.unsubscribeLight = this.light.subscribe(() => {
      this.applyGroupSnapshotToMembers();
      this.notifyListeners();
    });

    const disconnectLight = this.light.connect(bus);
    this.applyGroupSnapshotToMembers();

    return () => {
      disconnectLight();
      this.unsubscribeLight?.();
      this.unsubscribeLight = null;
    };
  }

  setLevelAndTemperature(
    level: number,
    temperatureMired: number,
    transitionMs = 0
  ) {
    this.light.setLevelAndTemperature(level, temperatureMired, transitionMs);
  }

  setLevel(level: number) {
    this.light.setLevel(level);
  }

  setTemperatureMired(temperatureMired: number) {
    this.light.setTemperatureMired(temperatureMired);
  }

  turnOff() {
    this.light.turnOff();
  }

  getSnapshot() {
    return {
      ...this.light.getSnapshot(),
      memberIds: this.members.map((member) => member.id)
    };
  }

  private applyGroupSnapshotToMembers() {
    const snapshot = this.light.getSnapshot();

    for (const member of this.members) {
      member.setLevelAndTemperature(
        snapshot.level,
        snapshot.temperatureMired,
        snapshot.transitionMs
      );
    }
  }
}
