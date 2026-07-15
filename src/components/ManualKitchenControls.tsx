import { kitchenZones } from '../automations/kitchen-entities';
import { icons } from '../icons';
import type { SimulatorVirtualDevices } from '../virtual/simulator-virtual-devices';
import { ManualButtonControlCard } from './ManualButtonControlCard';
import { ManualLightSensorControlCard } from './ManualLightSensorControlCard';
import { ManualMotionSensorCard } from './ManualMotionSensorCard';

type ManualKitchenControlsProps = {
  virtualDevices: SimulatorVirtualDevices;
};

const illuminancePresets = [0, 20, 30, 45, 150, 200, 300, 500];

export function ManualKitchenControls({
  virtualDevices
}: ManualKitchenControlsProps) {
  return (
    <>
      {kitchenZones.map((zone) => (
        <ManualMotionSensorCard
          key={`manual-motion-${zone.id}`}
          title={`Manual motion ${zone.label}`}
          sensor={virtualDevices.motionSensors[zone.motionKey]}
          icon={icons.motionSensor}
        />
      ))}

      {kitchenZones.map((zone) => (
        <ManualLightSensorControlCard
          key={`manual-illuminance-${zone.id}`}
          title={`Manual illuminance ${zone.label}`}
          sensor={virtualDevices.lightSensors[zone.illuminanceKey]}
          presets={illuminancePresets}
          dropdownIcon={icons.chevronDown}
        />
      ))}

      <ManualButtonControlCard
        title="Manual button masterButton"
        button={virtualDevices.button}
      />
    </>
  );
}
