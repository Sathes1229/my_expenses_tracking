import { describe, expect, it } from 'vitest';
import { meterParts } from '@/components/meter-parts';

describe('meterParts', () => {
  it('returns the fill and threshold as percentages of max', () => {
    expect(meterParts(40, 100, 80)).toEqual({ fillPct: 40, thresholdPct: 80, over: false });
  });

  it('clamps the fill to 100 and flags over when value passes max', () => {
    expect(meterParts(130, 100, 80)).toEqual({ fillPct: 100, thresholdPct: 80, over: true });
  });

  it('shows an empty meter with no threshold when max is zero', () => {
    expect(meterParts(10, 0)).toEqual({ fillPct: 0, thresholdPct: null, over: false });
  });

  it('clamps a negative value to an empty fill', () => {
    expect(meterParts(-5, 100)).toEqual({ fillPct: 0, thresholdPct: null, over: false });
  });

  it('counts exactly max as full but not over', () => {
    expect(meterParts(100, 100, 80)).toEqual({ fillPct: 100, thresholdPct: 80, over: false });
  });
});
