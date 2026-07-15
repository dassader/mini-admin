import { h, type ComponentType, type VNode } from 'preact';
import type { AppRuntime } from './runtime';

export type InjectionTools = {
  componentId: string;
};

type ComponentDefinitionInput<TProps> = {
  id: string;
  component: ComponentType<TProps>;
  inject: (runtime: AppRuntime, tools: InjectionTools) => TProps;
  when?: (runtime: AppRuntime) => boolean;
};

type ViewSlotInput = {
  id: string;
  view: ViewDefinition;
  when?: (runtime: AppRuntime) => boolean;
};

export type ComponentSlot = {
  id: string;
  render: (runtime: AppRuntime) => VNode<any> | null;
  when?: (runtime: AppRuntime) => boolean;
};

export type ViewRegionElement = 'section' | 'header' | 'main' | 'footer';

export type ViewRegion = {
  id: string;
  element?: ViewRegionElement;
  className?: string;
  innerClassName?: string;
  ariaLabel?: string;
  slots: ComponentSlot[];
  when?: (runtime: AppRuntime) => boolean;
};

export type ViewDefinition = {
  id: string;
  className?: string;
  ariaLabel?: string;
  slots?: ComponentSlot[];
  regions?: ViewRegion[];
};

type ViewRendererProps = {
  runtime: AppRuntime;
  view: ViewDefinition;
};

type SlotRendererProps = {
  runtime: AppRuntime;
  slot: ComponentSlot;
};

type RegionRendererProps = {
  runtime: AppRuntime;
  region: ViewRegion;
};

export function defineComponent<TProps>({
  id,
  component: Component,
  inject,
  when
}: ComponentDefinitionInput<TProps>): ComponentSlot {
  return {
    id,
    when,
    render(runtime) {
      if (when && !when(runtime)) return null;

      const props = inject(runtime, {
        componentId: id
      });

      return h(Component, props as any);
    }
  };
}

export function defineView(view: ViewDefinition): ViewDefinition {
  return view;
}

export function defineViewSlot({ id, view, when }: ViewSlotInput): ComponentSlot {
  return {
    id,
    when,
    render(runtime) {
      if (when && !when(runtime)) return null;
      return <ViewRenderer runtime={runtime} view={view} />;
    }
  };
}

export function ViewRenderer({ runtime, view }: ViewRendererProps) {
  return (
    <section class={view.className} aria-label={view.ariaLabel}>
      {view.regions?.map((region) => (
        <RegionRenderer key={region.id} runtime={runtime} region={region} />
      ))}
      {view.slots?.map((slot) => (
        <SlotRenderer key={slot.id} runtime={runtime} slot={slot} />
      ))}
    </section>
  );
}

function RegionRenderer({ runtime, region }: RegionRendererProps) {
  if (region.when && !region.when(runtime)) return null;

  const content = (
    <>
      {region.slots.map((slot) => (
        <SlotRenderer key={slot.id} runtime={runtime} slot={slot} />
      ))}
    </>
  );

  const children = region.innerClassName ? (
    <div class={region.innerClassName}>{content}</div>
  ) : (
    content
  );

  switch (region.element) {
    case 'header':
      return (
        <header class={region.className} aria-label={region.ariaLabel}>
          {children}
        </header>
      );
    case 'main':
      return (
        <main class={region.className} aria-label={region.ariaLabel}>
          {children}
        </main>
      );
    case 'footer':
      return (
        <footer class={region.className} aria-label={region.ariaLabel}>
          {children}
        </footer>
      );
    case 'section':
    default:
      return (
        <section class={region.className} aria-label={region.ariaLabel}>
          {children}
        </section>
      );
  }
}

function SlotRenderer({ runtime, slot }: SlotRendererProps) {
  if (slot.when && !slot.when(runtime)) return null;
  return slot.render(runtime);
}
