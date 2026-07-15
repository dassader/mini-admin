type GlowingLightPreviewProps = {
  level: number;
  minLevel: number;
  maxLevel: number;
  temperatureMired: number;
};

export function GlowingLightPreview({
  level,
  minLevel,
  maxLevel,
  temperatureMired
}: GlowingLightPreviewProps) {
  const rawIntensity = normalize(level, minLevel, maxLevel);
  const isOff = rawIntensity <= 0;
  const visibleIntensity = isOff ? 0 : Math.max(0.008, rawIntensity ** 1.7);
  const [red, green, blue] = miredToRgb(temperatureMired);
  const auraOpacity = isOff ? 0 : 0.03 + visibleIntensity * 0.5;
  const coreOpacity = isOff ? 0 : 0.08 + visibleIntensity * 0.92;
  const coreSize = 24;
  const glowSize = isOff ? 0 : 36 + visibleIntensity * 108;
  const roomLight = isOff ? 0 : 0.01 + visibleIntensity * 0.54;
  const floorLight = isOff ? 0 : 0.006 + visibleIntensity * 0.3;

  return (
    <div
      aria-label={isOff ? 'Light is off in a dark room' : 'Light preview in a dark room'}
      class="glowing-light-preview"
      data-light-state={isOff ? 'off' : 'on'}
      data-testid="glowing-light-preview"
      style={[
        `--light-rgb:${red} ${green} ${blue}`,
        `--light-aura-opacity:${auraOpacity.toFixed(3)}`,
        `--light-core-opacity:${coreOpacity.toFixed(3)}`,
        `--light-core-size:${coreSize.toFixed(1)}px`,
        `--light-glow-size:${glowSize.toFixed(1)}px`,
        `--light-room-opacity:${roomLight.toFixed(3)}`,
        `--light-floor-opacity:${floorLight.toFixed(3)}`
      ].join(';')}
    >
      <span class="glowing-light-preview__wall" />
      <span class="glowing-light-preview__floor" />
      <span class="glowing-light-preview__aura" />
      <span class="glowing-light-preview__core" />
    </div>
  );
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.min(Math.max((value - min) / (max - min), 0), 1);
}

function miredToRgb(mired: number): [number, number, number] {
  const kelvin = 1_000_000 / Math.max(mired, 1);
  const temperature = kelvin / 100;
  let red = 255;
  let green = 255;
  let blue = 255;

  if (temperature <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661;
    blue =
      temperature <= 19
        ? 0
        : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * (temperature - 60) ** -0.1332047592;
    green = 288.1221695283 * (temperature - 60) ** -0.0755148492;
    blue = 255;
  }

  return [clampColor(red), clampColor(green), clampColor(blue)];
}

function clampColor(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 255));
}
