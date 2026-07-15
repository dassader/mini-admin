import {
  Activity,
  Atom,
  BatteryMedium,
  Box,
  Cable,
  ChartNoAxesCombined,
  CircleDot,
  CircleGauge,
  Cloud,
  CloudFog,
  CloudRain,
  Compass,
  Droplet,
  Droplets,
  Factory,
  Flame,
  FlaskConical,
  Gauge,
  PlugZap,
  Radio,
  Radiation,
  Route,
  Ruler,
  Signal,
  Sun,
  SunMedium,
  TestTubeDiagonal,
  Thermometer,
  Volume2,
  Waves,
  Weight,
  Wind,
  Workflow,
  Zap,
  Clock3,
  type LucideIcon
} from 'lucide-react';
import type { EntityState } from '../../hardware/use-mini-bus-lab';
import { Card } from './Card';
import { relativeTime } from './format';

type NumericSensorMeta = {
  title: string;
  label: string;
  unit: string;
  icon: LucideIcon;
  precision?: number;
};

const SENSOR_META: Record<number, NumericSensorMeta> = {
  0x00: { title: 'Numeric sensor', label: 'Значение', unit: '', icon: Activity },
  0x01: { title: 'Battery sensor', label: 'Заряд', unit: '%', icon: BatteryMedium },
  0x02: { title: 'Temperature sensor', label: 'Температура', unit: '°C', icon: Thermometer, precision: 1 },
  0x03: { title: 'Humidity sensor', label: 'Влажность', unit: '%', icon: Droplets, precision: 1 },
  0x04: { title: 'Illuminance sensor', label: 'Освещённость', unit: 'lux', icon: Sun },
  0x05: { title: 'Pressure sensor', label: 'Давление', unit: 'hPa', icon: Gauge, precision: 1 },
  0x06: { title: 'Soil moisture sensor', label: 'Влажность', unit: '%', icon: Waves, precision: 1 },
  0x07: { title: 'CO₂ sensor', label: 'CO₂', unit: 'ppm', icon: Cloud },
  0x08: { title: 'CO sensor', label: 'CO', unit: 'ppm', icon: CloudFog, precision: 1 },
  0x09: { title: 'VOC sensor', label: 'VOC', unit: 'ppb', icon: Factory },
  0x0a: { title: 'PM1 sensor', label: 'PM1', unit: 'µg/m³', icon: Atom, precision: 1 },
  0x0b: { title: 'PM2.5 sensor', label: 'PM2.5', unit: 'µg/m³', icon: CircleDot, precision: 1 },
  0x0c: { title: 'PM10 sensor', label: 'PM10', unit: 'µg/m³', icon: Radiation, precision: 1 },
  0x0d: { title: 'Air quality sensor', label: 'AQI', unit: '', icon: CircleGauge },
  0x0e: { title: 'Sound pressure sensor', label: 'Громкость', unit: 'dB', icon: Volume2, precision: 1 },
  0x0f: { title: 'pH sensor', label: 'Кислотность', unit: 'pH', icon: FlaskConical, precision: 2 },
  0x10: { title: 'Conductivity sensor', label: 'Проводимость', unit: 'µS/cm', icon: TestTubeDiagonal, precision: 1 },
  0x11: { title: 'Voltage sensor', label: 'Напряжение', unit: 'V', icon: PlugZap, precision: 2 },
  0x12: { title: 'Current sensor', label: 'Ток', unit: 'A', icon: Cable, precision: 2 },
  0x13: { title: 'Power sensor', label: 'Мощность', unit: 'W', icon: Zap, precision: 1 },
  0x14: { title: 'Energy sensor', label: 'Энергия', unit: 'kWh', icon: ChartNoAxesCombined, precision: 2 },
  0x15: { title: 'Frequency sensor', label: 'Частота', unit: 'Hz', icon: Radio, precision: 1 },
  0x16: { title: 'Signal strength sensor', label: 'Сигнал', unit: 'dBm', icon: Signal },
  0x17: { title: 'Distance sensor', label: 'Расстояние', unit: 'm', icon: Ruler, precision: 2 },
  0x18: { title: 'Speed sensor', label: 'Скорость', unit: 'm/s', icon: Route, precision: 2 },
  0x19: { title: 'Weight sensor', label: 'Вес', unit: 'kg', icon: Weight, precision: 2 },
  0x1a: { title: 'Volume sensor', label: 'Объём', unit: 'L', icon: Box, precision: 2 },
  0x1b: { title: 'Flow rate sensor', label: 'Расход', unit: 'L/min', icon: Workflow, precision: 2 },
  0x1c: { title: 'Water meter', label: 'Вода', unit: 'L', icon: Droplet, precision: 2 },
  0x1d: { title: 'Gas meter', label: 'Газ', unit: 'm³', icon: Flame, precision: 3 },
  0x1e: { title: 'Wind direction sensor', label: 'Направление', unit: '°', icon: Compass },
  0x1f: { title: 'Wind speed sensor', label: 'Скорость ветра', unit: 'm/s', icon: Wind, precision: 1 },
  0x20: { title: 'Precipitation sensor', label: 'Осадки', unit: 'mm', icon: CloudRain, precision: 1 },
  0x21: { title: 'Irradiance sensor', label: 'Излучение', unit: 'W/m²', icon: SunMedium, precision: 1 }
};

export function NumericSensorCard({ entity, now }: { entity: EntityState; now: number }) {
  const sensorClass = entity.sensorClass ?? entity.subtype;
  const meta = SENSOR_META[sensorClass] ?? SENSOR_META[0];
  const Icon = meta.icon;
  const value = typeof entity.value === 'number' ? entity.value : 0;
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: meta.precision ?? 2
  }).format(value);

  return (
    <Card title={meta.title} icon={<Icon size={21} />} className="entity-card numeric-sensor-card">
      <p className="entity-name">{entity.name}</p>
      <p className="entity-id">{entity.id}</p>
      <div className="sensor-reading">
        <span>{meta.label}</span>
        <strong>{formatted} {meta.unit && <small>{meta.unit}</small>}</strong>
      </div>
      <p className="updated-at">
        <Clock3 size={16} aria-hidden="true" />Обновлено {relativeTime(entity.lastSeenAt, now)}
      </p>
    </Card>
  );
}
