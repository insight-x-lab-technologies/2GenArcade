export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smooth ease-out used for juice (e.g. flash/shake decay). */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const randInt = (minInclusive: number, maxInclusive: number): number =>
  Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
