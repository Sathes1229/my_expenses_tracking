export type MeterParts = {
  /** Width of the fill, 0 to 100. */
  fillPct: number;
  /** Position of the threshold tick, 0 to 100, or null when there is none. */
  thresholdPct: number | null;
  /** True when value is above max. */
  over: boolean;
};

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Geometry for the Meter. Pure, so it is tested without a DOM.
 * A max of zero or less has nothing to measure against: empty fill, no tick.
 */
export function meterParts(value: number, max: number, thresholdPct?: number): MeterParts {
  if (!(max > 0)) return { fillPct: 0, thresholdPct: null, over: false };
  return {
    fillPct: clampPct((value / max) * 100),
    thresholdPct: thresholdPct === undefined ? null : clampPct(thresholdPct),
    over: value > max,
  };
}
