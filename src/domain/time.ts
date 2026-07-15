export type TimeController = {
  current: Date;
  timestampMs: number;
  set: (nextTime: Date) => void;
  shiftByMs: (offsetMs: number) => void;
  resetToBrowserNow: () => void;
};

export type TimeJump = {
  id: string;
  label: string;
  offsetMs: number;
};

export const timeJumps: TimeJump[] = [
  { id: 'plus-1s', label: '+1s', offsetMs: 1_000 },
  { id: 'plus-10s', label: '+10s', offsetMs: 10_000 },
  { id: 'plus-1m', label: '+1m', offsetMs: 60_000 },
  { id: 'plus-10m', label: '+10m', offsetMs: 600_000 },
  { id: 'plus-30m', label: '+30m', offsetMs: 1_800_000 }
];
