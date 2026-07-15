import {
  Binary,
  Boxes,
  Home,
  ListTree,
  Network,
  PlugZap,
  Workflow
} from 'lucide-preact';

export type LabSection = 'overview' | 'network' | 'entities' | 'automations' | 'events' | 'raw';

type LabSidebarProps = {
  active: LabSection;
  onNavigate: (section: LabSection) => void;
  onConnect: () => void;
};

const ITEMS = [
  { id: 'overview', label: 'Обзор', icon: Home },
  { id: 'network', label: 'Сеть', icon: Network },
  { id: 'entities', label: 'Сущности', icon: Boxes },
  { id: 'automations', label: 'Автоматизации', icon: Workflow },
  { id: 'events', label: 'События', icon: ListTree },
  { id: 'raw', label: 'Raw Frames', icon: Binary }
] satisfies Array<{ id: LabSection; label: string; icon: typeof Home }>;

export function LabSidebar({ active, onNavigate, onConnect }: LabSidebarProps) {
  return (
    <aside class="lab-sidebar" aria-label="Навигация Mini Bus Lab">
      <nav class="lab-nav">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            class={active === id ? 'lab-nav__item is-active' : 'lab-nav__item'}
            onClick={() => onNavigate(id)}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <button class="sidebar-connect" type="button" onClick={onConnect}>
        <PlugZap size={17} />
        <span>Выбрать устройство</span>
      </button>
    </aside>
  );
}
