import type { Bus } from '../bus/bus';
import type { TimeController } from '../domain/time';
import type { KitchenLightingAutomationRuntime } from '../automations/kitchen-lighting-automations';
import type { SimulatorVirtualDevices } from '../virtual/simulator-virtual-devices';

export type AppRuntime = {
  bus: Bus;
  virtualTime: TimeController;
  virtualDevices: SimulatorVirtualDevices;
  automations: KitchenLightingAutomationRuntime;
};
