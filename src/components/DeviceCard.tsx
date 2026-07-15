import type { ComponentChildren } from 'preact';

type DeviceCardProps = {
  children: ComponentChildren;
  className?: string;
  deviceId?: string;
};

export function DeviceCard({
  children,
  className = '',
  deviceId
}: DeviceCardProps) {
  const classes = ['device-card', className].filter(Boolean).join(' ');

  return (
    <article class={classes} data-device-id={deviceId}>
      {children}
    </article>
  );
}
