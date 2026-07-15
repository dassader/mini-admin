import { ChevronDown, PersonStanding } from 'lucide-preact';
import type { LucideIcon } from 'lucide-preact';

export type AppIcon = LucideIcon;

export const icons = {
  chevronDown: ChevronDown,
  motionSensor: PersonStanding
} satisfies Record<string, AppIcon>;
