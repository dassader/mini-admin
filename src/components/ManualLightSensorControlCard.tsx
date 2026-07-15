import { useEffect, useState } from 'preact/hooks';
import type { AppIcon } from '../icons';
import { VirtualNumericSensor } from '../virtual/VirtualNumericSensor';
import { DeviceCard } from './DeviceCard';
import { DropdownMenu } from './DropdownMenu';

type ManualLightSensorControlCardProps = {
  title: string;
  sensor: VirtualNumericSensor;
  presets: number[];
  dropdownIcon: AppIcon;
};

export function ManualLightSensorControlCard({
  title,
  sensor,
  presets,
  dropdownIcon
}: ManualLightSensorControlCardProps) {
  const [snapshot, setSnapshot] = useState(() => sensor.getSnapshot());

  useEffect(
    () => sensor.subscribe(() => setSnapshot(sensor.getSnapshot())),
    [sensor]
  );

  const setIlluminance = (nextLux: number) => {
    sensor.setRawValue(nextLux);
  };

  return (
    <DeviceCard
      className="manual-card manual-light-sensor-card"
      deviceId={`manual-${sensor.id}`}
    >
      <header class="manual-card__header">
        <h2>{title}</h2>
        <dl class="sensor-fields">
          <div>
            <dt>Target:</dt>
            <dd>{sensor.id}</dd>
          </div>
          <div>
            <dt>Value:</dt>
            <dd>{snapshot.rawValue} lx</dd>
          </div>
        </dl>
      </header>

      <div class="manual-card__controls">
        <label class="manual-card__slider">
          <span class="sr-only">Illuminance</span>
          <input
            type="range"
            min={sensor.minRawValue}
            max={sensor.maxRawValue}
            step="1"
            value={snapshot.rawValue}
            onInput={(event) => setIlluminance(Number(event.currentTarget.value))}
          />
        </label>

        <DropdownMenu
          className="light-sensor-card__preset"
          icon={dropdownIcon}
          label="Presets"
          menuClassName="light-sensor-card__preset-menu"
          optionClassName="light-sensor-card__preset-option"
          options={presets.map((preset) => ({
            id: String(preset),
            label: `${preset} lx`,
            onSelect: () => setIlluminance(preset)
          }))}
          triggerClassName="light-sensor-card__preset-trigger"
        />
      </div>
    </DeviceCard>
  );
}
