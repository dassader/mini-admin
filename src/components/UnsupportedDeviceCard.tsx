import { DeviceCard } from './DeviceCard';

type UnsupportedDeviceCardProps = {
  title: string;
  description: string;
};

export function UnsupportedDeviceCard({
  title,
  description
}: UnsupportedDeviceCardProps) {
  return (
    <DeviceCard className="unsupported-device-card">
      <header class="unsupported-device-card__header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
    </DeviceCard>
  );
}
