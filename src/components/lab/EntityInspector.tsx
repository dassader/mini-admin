import {
  Activity,
  CircleDot,
  Lightbulb,
  Radio,
  RefreshCw,
  Route,
  Zap
} from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import {
  LAB_ZONES,
  type MiniBusLabState,
  type ZigBeeDevice
} from '../../hardware/use-mini-bus-lab';

type EntityInspectorProps = Pick<
  MiniBusLabState,
  'selectedEntity' | 'zigbeeDevices' | 'scan' | 'setLight' | 'injectMotion'
>;

export function EntityInspector({
  selectedEntity,
  zigbeeDevices,
  scan,
  setLight,
  injectMotion
}: EntityInspectorProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'attributes' | 'clusters'>('info');

  useEffect(() => setActiveTab('info'), [selectedEntity?.id]);

  if (!selectedEntity) {
    return (
      <aside class="entity-inspector workspace-panel">
        <header class="section-header">
          <span class="section-kicker">Инспектор сущности</span>
        </header>
        <div class="inspector-empty">
          <CircleDot size={24} />
          <strong>Выберите сущность</strong>
          <span>Topology и карточки зон открывают живые protocol details.</span>
        </div>
      </aside>
    );
  }

  const zone = LAB_ZONES.find(
    (item) =>
      item.lightId === selectedEntity.id ||
      item.motionId === selectedEntity.id ||
      item.luxId === selectedEntity.id
  );
  const zigbee = zone
    ? zigbeeDevices.find((device) => device.ieee === zone.zigbeeIeee)
    : findRelatedDevice(selectedEntity.id, zigbeeDevices);
  const level = Math.max(selectedEntity.warm ?? 0, selectedEntity.cold ?? 0);

  return (
    <aside class="entity-inspector workspace-panel">
      <header class="inspector-title">
        <span class="inspector-title__icon">
          {selectedEntity.type === 0 ? <Lightbulb size={19} /> : <Activity size={19} />}
        </span>
        <div>
          <strong>{selectedEntity.name}</strong>
          <span><span class="node-health is-online" /> Онлайн</span>
        </div>
      </header>

      <div class="inspector-tabs" role="tablist" aria-label="Секции инспектора">
        <button
          class={activeTab === 'info' ? 'is-active' : undefined}
          type="button"
          onClick={() => setActiveTab('info')}
        >
          Информация
        </button>
        <button
          class={activeTab === 'attributes' ? 'is-active' : undefined}
          type="button"
          onClick={() => setActiveTab('attributes')}
        >
          Атрибуты
        </button>
        <button
          class={activeTab === 'clusters' ? 'is-active' : undefined}
          type="button"
          onClick={() => setActiveTab('clusters')}
        >
          Кластеры
        </button>
      </div>

      {activeTab === 'info' && (
        <dl class="inspector-fields">
          <InspectorField label="Entity ID" value={selectedEntity.id} mono />
          <InspectorField label="Board" value={selectedEntity.board} mono />
          <InspectorField label="Тип" value={entityTypeLabel(selectedEntity.type, selectedEntity.subtype)} />
          <InspectorField label="Зона" value={selectedEntity.zone ?? '—'} />
          <InspectorField label="Производитель" value={zigbee?.manufacturer || '—'} />
          <InspectorField label="Модель" value={zigbee?.model || '—'} />
          <InspectorField label="IEEE" value={zigbee?.ieee || '—'} mono />
          <InspectorField
            label="Short address"
            value={zigbee ? `0x${zigbee.shortAddress.toString(16).toUpperCase()}` : '—'}
            mono
          />
          <InspectorField label="Endpoint" value={zigbee?.endpoints.join(', ') || 'Опрос…'} mono />
          <InspectorField label="Последний пакет" value={relativeTime(selectedEntity.lastSeenAt)} />
        </dl>
      )}

      {activeTab === 'attributes' && (
        <dl class="inspector-fields">
          <InspectorField label="Result" value={String(selectedEntity.result)} mono />
          <InspectorField label="Timestamp" value={String(selectedEntity.timestampMs)} mono />
          <InspectorField label="Subtype" value={String(selectedEntity.subtype)} mono />
          <InspectorField label="Capabilities" value={String(selectedEntity.capabilities ?? '—')} mono />
          {selectedEntity.type === 0 && <InspectorField label="Warm" value={String(selectedEntity.warm ?? 0)} mono />}
          {selectedEntity.type === 0 && <InspectorField label="Cold" value={String(selectedEntity.cold ?? 0)} mono />}
          {selectedEntity.type === 0 && <InspectorField label="Уровень" value={`${Math.round((level / 255) * 100)}%`} />}
          {selectedEntity.type === 1 && <InspectorField label="Состояние" value={selectedEntity.value ? 'Detected' : 'Clear'} />}
          {selectedEntity.type === 2 && <InspectorField label="Значение" value={`${selectedEntity.value ?? '—'} lux`} />}
          {selectedEntity.sensorClass !== undefined && <InspectorField label="Sensor class" value={String(selectedEntity.sensorClass)} mono />}
        </dl>
      )}

      {activeTab === 'clusters' && (
        <div class="cluster-list">
          {zigbee?.clusters.length ? (
            zigbee.clusters.map((cluster) => (
              <div key={`${cluster.endpoint}-${cluster.clusterId}-${cluster.role}`}>
                <span>Endpoint {cluster.endpoint}</span>
                <strong class="mono">0x{cluster.clusterId.toString(16).padStart(4, '0').toUpperCase()}</strong>
                <small>{cluster.role === 0 ? 'server' : 'client'}</small>
              </div>
            ))
          ) : (
            <p>Cluster inventory ещё не получен. Нажмите «Опросить».</p>
          )}
        </div>
      )}

      <div class="inspector-section">
        <span class="inspector-section__title">Protocol route</span>
        <div class="route-line">
          <Radio size={14} />
          <span>Serial / Mini Bus</span>
          <Route size={14} />
          <span>{selectedEntity.type === 0 ? 'Light' : 'Device'}</span>
        </div>
      </div>

      <div class="inspector-section">
        <span class="inspector-section__title">Быстрые действия</span>
        <div class="inspector-actions">
          <button class="quiet-button" type="button" onClick={scan}>
            <RefreshCw size={14} /> Опросить
          </button>
          {selectedEntity.type === 0 && (
            <button
              class="quiet-button"
              type="button"
              onClick={() => void setLight(selectedEntity.id, 0, 0)}
            >
              <Lightbulb size={14} /> Выключить
            </button>
          )}
          {selectedEntity.type === 1 && (
            <button
              class="quiet-button quiet-button--accent"
              type="button"
              onClick={() => void injectMotion(selectedEntity.id)}
            >
              <Zap size={14} /> Fake motion
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function InspectorField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd class={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  );
}

function entityTypeLabel(type: number, subtype: number) {
  const names = ['Light', 'Binary sensor', 'Numeric sensor', 'Button'];
  return `${names[type] ?? `Type ${type}`} · subtype ${subtype}`;
}

function findRelatedDevice(entityId: string, devices: ZigBeeDevice[]) {
  const normalized = entityId.replace(/^0x/, '');
  return devices.find((device) => normalized === reverseHexBytes(device.ieee));
}

function reverseHexBytes(value: string) {
  return value.match(/.{2}/g)?.reverse().join('') ?? value;
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return seconds < 2 ? 'только что' : `${seconds} сек назад`;
}
