import {
  CircuitBoard,
  Lightbulb,
  MousePointerClick,
  PersonStanding,
  Radio,
  SunMedium
} from 'lucide-preact';
import {
  LAB_ZONES,
  type EntityState,
  type MiniBusLabState
} from '../../hardware/use-mini-bus-lab';

type NetworkTopologyProps = Pick<
  MiniBusLabState,
  'boards' | 'entities' | 'zigbeeDevices' | 'selectedEntityId' | 'setSelectedEntityId' | 'scan'
>;

export function NetworkTopology({
  boards,
  entities,
  zigbeeDevices,
  selectedEntityId,
  setSelectedEntityId,
  scan
}: NetworkTopologyProps) {
  const board = boards[0];
  const button = entities.find((entity) => entity.type === 3);

  return (
    <section class="workspace-panel topology-panel" id="network">
      <header class="section-header">
        <div>
          <span class="section-kicker">Топология сети ZigBee</span>
          <strong>{zigbeeDevices.length} устройств · {entities.length} сущностей</strong>
        </div>
        <button class="quiet-button" type="button" onClick={scan}>
          Обновить
        </button>
      </header>

      <div class="topology-canvas">
        <div class="topology-grid" aria-label="Топология устройств">
          <div class="topology-column topology-column--coordinator">
            <TopologyNode
              className="topology-node--coordinator"
              icon={CircuitBoard}
              title="Coordinator"
              subtitle={board?.id ?? 'Board not found'}
              meta={`ZigBee 3.0 · ${zigbeeDevices.length} nodes`}
              online={Boolean(board)}
            />
          </div>

          <div class="topology-bus" aria-hidden="true">
            <span />
          </div>

          <div class="topology-column topology-column--entities">
            {LAB_ZONES.map((zone) => (
              <TopologyEntityNode
                key={zone.lightId}
                entity={findEntity(entities, zone.lightId)}
                fallbackTitle={`${zone.name} Light`}
                icon={Lightbulb}
                selected={selectedEntityId === zone.lightId}
                onSelect={() => setSelectedEntityId(zone.lightId)}
              />
            ))}
            <TopologyEntityNode
              entity={button}
              fallbackTitle="Master Button"
              icon={MousePointerClick}
              selected={selectedEntityId === button?.id}
              onSelect={() => button && setSelectedEntityId(button.id)}
            />
          </div>

          <div class="topology-bus topology-bus--secondary" aria-hidden="true">
            <span />
          </div>

          <div class="topology-column topology-column--sensors">
            {LAB_ZONES.map((zone) => (
              <TopologyEntityNode
                key={zone.motionId}
                entity={findEntity(entities, zone.motionId)}
                fallbackTitle={`${zone.name} Motion`}
                icon={PersonStanding}
                selected={selectedEntityId === zone.motionId}
                onSelect={() => setSelectedEntityId(zone.motionId)}
              />
            ))}
            <TopologyEntityNode
              entity={findEntity(entities, LAB_ZONES[0].luxId)}
              fallbackTitle="Illuminance sensors"
              icon={SunMedium}
              selected={selectedEntityId === LAB_ZONES[0].luxId}
              onSelect={() => setSelectedEntityId(LAB_ZONES[0].luxId)}
              meta={`${LAB_ZONES.length} measurements`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function TopologyEntityNode({
  entity,
  fallbackTitle,
  icon,
  selected,
  onSelect,
  meta
}: {
  entity?: EntityState;
  fallbackTitle: string;
  icon: typeof Radio;
  selected: boolean;
  onSelect: () => void;
  meta?: string;
}) {
  return (
    <button
      type="button"
      class={selected ? 'topology-node is-selected' : 'topology-node'}
      onClick={onSelect}
    >
      <TopologyNode
        icon={icon}
        title={entity?.name ?? fallbackTitle}
        subtitle={entity ? shortId(entity.id) : 'Ожидание discovery'}
        meta={meta ?? (entity ? `Seen ${relativeTime(entity.lastSeenAt)}` : 'Нет данных')}
        online={Boolean(entity)}
      />
    </button>
  );
}

function TopologyNode({
  className = '',
  icon: Icon,
  title,
  subtitle,
  meta,
  online
}: {
  className?: string;
  icon: typeof Radio;
  title: string;
  subtitle: string;
  meta: string;
  online: boolean;
}) {
  return (
    <div class={`topology-node__inner ${className}`}>
      <span class="topology-node__icon">
        <Icon size={18} strokeWidth={1.7} />
      </span>
      <span class="topology-node__content">
        <strong>{title}</strong>
        <span class="mono">{subtitle}</span>
        <small>{meta}</small>
      </span>
      <span class={online ? 'node-health is-online' : 'node-health'} aria-label={online ? 'Онлайн' : 'Нет данных'} />
    </div>
  );
}

function findEntity(entities: EntityState[], id: string) {
  return entities.find((entity) => entity.id === id);
}

function shortId(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-5)}`;
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return seconds < 2 ? 'now' : `${seconds}s ago`;
}
