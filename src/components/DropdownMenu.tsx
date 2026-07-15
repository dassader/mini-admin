import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { AppIcon } from '../icons';
import { AppButton } from './AppButton';

export type DropdownMenuOption = {
  id: string;
  label: string;
  onSelect: () => void;
};

type DropdownMenuPosition = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

type DropdownMenuProps = {
  label: string;
  options: DropdownMenuOption[];
  className?: string;
  icon?: AppIcon;
  menuClassName?: string;
  optionClassName?: string;
  triggerClassName?: string;
};

const viewportMargin = 8;
const menuGap = 8;
const minMenuWidth = 116;

export function DropdownMenu({
  label,
  options,
  className = '',
  icon,
  menuClassName = '',
  optionClassName = '',
  triggerClassName = ''
}: DropdownMenuProps) {
  const [isOpen, setOpen] = useState(false);
  const [position, setPosition] = useState<DropdownMenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const root = rootRef.current;
    const menu = menuRef.current;
    if (!root || !menu) return;

    const triggerRect = root.getBoundingClientRect();
    const menuHeight = menu.scrollHeight;
    const menuWidth = Math.min(
      Math.max(minMenuWidth, triggerRect.width),
      window.innerWidth - viewportMargin * 2
    );
    const belowSpace =
      window.innerHeight - triggerRect.bottom - menuGap - viewportMargin;
    const aboveSpace = triggerRect.top - menuGap - viewportMargin;
    const openBelow =
      belowSpace >= Math.min(menuHeight, 180) || belowSpace >= aboveSpace;
    const availableHeight = Math.max(0, openBelow ? belowSpace : aboveSpace);
    const maxHeight = Math.max(64, Math.min(menuHeight, availableHeight));
    const left = clamp(
      triggerRect.right - menuWidth,
      viewportMargin,
      window.innerWidth - viewportMargin - menuWidth
    );
    const top = openBelow
      ? clamp(
          triggerRect.bottom + menuGap,
          viewportMargin,
          window.innerHeight - viewportMargin - maxHeight
        )
      : clamp(
          triggerRect.top - menuGap - maxHeight,
          viewportMargin,
          window.innerHeight - viewportMargin - maxHeight
        );

    setPosition({
      left,
      maxHeight,
      top,
      width: menuWidth
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, options.length]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, options.length]);

  const menuClasses = ['dropdown-menu', menuClassName].filter(Boolean).join(' ');
  const optionClasses = ['dropdown-menu__option', optionClassName]
    .filter(Boolean)
    .join(' ');
  const rootClasses = ['dropdown-menu-root', className].filter(Boolean).join(' ');
  const menuStyle = position
    ? [
        `left:${position.left.toFixed(1)}px`,
        `max-height:${position.maxHeight.toFixed(1)}px`,
        `top:${position.top.toFixed(1)}px`,
        `width:${position.width.toFixed(1)}px`
      ].join(';')
    : 'visibility:hidden';

  return (
    <div class={rootClasses} ref={rootRef}>
      <AppButton
        ariaExpanded={isOpen}
        ariaHasPopup="menu"
        className={triggerClassName}
        icon={icon}
        label={label}
        onClick={() => setOpen((current) => !current)}
        variant="neutral"
      />

      {isOpen && (
        <div class={menuClasses} ref={menuRef} role="menu" style={menuStyle}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              class={optionClasses}
              role="menuitem"
              onClick={() => {
                option.onSelect();
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
