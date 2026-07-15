import type { ComponentChildren } from 'preact';
import type { AppIcon } from '../icons';

export type AppButtonProps = {
  label: string;
  onClick: () => void;
  ariaExpanded?: boolean;
  ariaHasPopup?: 'menu';
  children?: ComponentChildren;
  icon?: AppIcon;
  title?: string;
  variant?: 'primary' | 'ghost' | 'neutral';
  className?: string;
};

export function AppButton({
  label,
  onClick,
  ariaExpanded,
  ariaHasPopup,
  children,
  icon: Icon,
  title,
  variant = 'primary',
  className = ''
}: AppButtonProps) {
  const classes = ['app-button', `app-button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      class={classes}
      title={title}
      onClick={onClick}
    >
      {Icon && <Icon size={18} strokeWidth={2.4} aria-hidden />}
      <span>{children ?? label}</span>
    </button>
  );
}
