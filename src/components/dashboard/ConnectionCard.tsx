import { Activity, Link2, Usb } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TrafficStats } from '../../hardware/use-mini-bus-lab';
import type { SerialPortDescriptor } from '../../hardware/web-serial';
import { Card } from './Card';

type ConnectionCardProps = {
  port: SerialPortDescriptor | null;
  stats: TrafficStats;
  now: number;
};

type TrafficHistoryPoint = {
  at: number;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
};

type TrafficSeriesPoint = {
  at: number;
  value: number;
};

const TRAFFIC_HISTORY_MS = 90_000;
const TRAFFIC_SAMPLE_MS = 1000;
const TRAFFIC_SMOOTHING = 0.28;

export function ConnectionCard({ port, stats, now }: ConnectionCardProps) {
  const [trafficHistory, setTrafficHistory] = useState<TrafficHistoryPoint[]>(() => [
    createTrafficHistoryPoint(stats, now)
  ]);
  const latestTraffic = trafficHistory[trafficHistory.length - 1];
  const rxRate = latestTraffic?.rxRate ?? 0;
  const txRate = latestTraffic?.txRate ?? 0;
  const rxSeries = useMemo(
    () => trafficHistory.map((point) => ({ at: point.at, value: point.rxRate })),
    [trafficHistory]
  );
  const txSeries = useMemo(
    () => trafficHistory.map((point) => ({ at: point.at, value: point.txRate })),
    [trafficHistory]
  );

  useEffect(() => {
    setTrafficHistory((current) => {
      const sample = createTrafficHistoryPoint(stats, now);
      const last = current[current.length - 1];
      const isNewSession =
        !last ||
        last.at < stats.startedAt ||
        sample.rxBytes < last.rxBytes ||
        sample.txBytes < last.txBytes;
      const base = isNewSession ? [] : current;
      const baseLast = base[base.length - 1];

      let next: TrafficHistoryPoint[];
      if (!baseLast) {
        next = [sample];
      } else if (sample.at - baseLast.at >= TRAFFIC_SAMPLE_MS) {
        next = [...base, createTrafficRatePoint(baseLast, sample)];
      } else if (
        sample.rxBytes !== baseLast.rxBytes ||
        sample.txBytes !== baseLast.txBytes
      ) {
        const previous = base[base.length - 2];
        next = previous
          ? [...base.slice(0, -1), createTrafficRatePoint(previous, sample)]
          : [sample];
      } else {
        return current;
      }

      const cutoff = sample.at - TRAFFIC_HISTORY_MS;
      const trimmed = next.filter((point) => point.at >= cutoff);
      return trimmed.length > 0 ? trimmed : [sample];
    });
  }, [now, stats.rxBytes, stats.txBytes, stats.startedAt]);

  return (
    <Card
      title="Connection"
      icon={<Link2 size={20} />}
      className="connection-card"
      action={<span className="live-label"><span className="status-dot" />Live</span>}
    >
      <div className="connection-usb">
        <span><Usb size={17} aria-hidden="true" />USB</span>
        <strong>{portLabel(port)}</strong>
      </div>

      <div className="traffic-list">
        <TrafficRow
          direction="RX"
          label="Входящий трафик"
          rate={rxRate}
          series={rxSeries}
        />
        <TrafficRow
          direction="TX"
          label="Исходящий трафик"
          rate={txRate}
          series={txSeries}
        />
      </div>

      <div className="error-metrics">
        <Diagnostic label="CRC ошибки" value={stats.crcErrors} />
        <Diagnostic label="Parse ошибки" value={stats.parseErrors} />
      </div>
    </Card>
  );
}

function TrafficRow({
  direction,
  label,
  rate,
  series
}: {
  direction: string;
  label: string;
  rate: number;
  series: TrafficSeriesPoint[];
}) {
  return (
    <div className="traffic-row">
      <div className="traffic-row__label">
        <strong>{direction}</strong>
        <span>{label}</span>
      </div>
      <TrafficSparkline series={series} label={`${label}: ${formatRate(rate)}`} />
      <strong className="traffic-rate">{formatRate(rate)}</strong>
    </div>
  );
}

function TrafficSparkline({
  series,
  label
}: {
  series: TrafficSeriesPoint[];
  label: string;
}) {
  const width = 119;
  const top = 6;
  const bottom = 28;
  const first = series[0];
  const last = series[series.length - 1];
  const startAt = first?.at ?? 0;
  const endAt = last?.at ?? startAt + 1;
  const maxValue = Math.max(0, ...series.map((point) => point.value));
  const valueRange = Math.max(4096, maxValue * 3.5);
  const timeRange = Math.max(1, endAt - startAt);

  const normalizedPoints = series.length > 1
    ? series.map((point) => {
        const x = ((point.at - startAt) / timeRange) * width;
        const y =
          bottom -
          (point.value / valueRange) * (bottom - top);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
    : [`0,${bottom}`, `${width},${bottom}`];
  const linePoints = normalizedPoints.join(' ');

  return (
    <svg className="sparkline" viewBox="0 0 119 34" role="img" aria-label={label} preserveAspectRatio="none">
      <polyline className="sparkline__line" points={linePoints} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Diagnostic({ label, value }: { label: string; value: number }) {
  return (
    <div className={value > 0 ? 'diagnostic diagnostic--error' : 'diagnostic'}>
      <Activity size={17} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function portLabel(port: SerialPortDescriptor | null) {
  if (!port) return 'USB Serial';
  return port.label.replace(/\s*·\s*115200$/, '');
}

function formatRate(bytesPerSecond: number) {
  if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
  return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
}

function createTrafficHistoryPoint(
  stats: TrafficStats,
  now: number
): TrafficHistoryPoint {
  return {
    at: now,
    rxBytes: stats.rxBytes,
    txBytes: stats.txBytes,
    rxRate: 0,
    txRate: 0
  };
}

function createTrafficRatePoint(
  previous: TrafficHistoryPoint,
  sample: TrafficHistoryPoint
): TrafficHistoryPoint {
  const seconds = Math.max(0.25, (sample.at - previous.at) / 1000);
  const rxInstantRate = Math.max(0, sample.rxBytes - previous.rxBytes) / seconds;
  const txInstantRate = Math.max(0, sample.txBytes - previous.txBytes) / seconds;

  return {
    ...sample,
    rxRate: smoothRate(previous.rxRate, rxInstantRate),
    txRate: smoothRate(previous.txRate, txInstantRate)
  };
}

function smoothRate(previous: number, current: number) {
  return previous * (1 - TRAFFIC_SMOOTHING) + current * TRAFFIC_SMOOTHING;
}
