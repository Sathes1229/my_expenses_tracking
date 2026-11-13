import { describe, expect, it } from 'vitest';
import { refuse, shown, startGate, withReading } from '@/app/(app)/assistant/availability';

describe('what the question box shows', () => {
  it('shows a refusal at once, and keeps it while the page reads the same as before', () => {
    let gate = refuse(startGate('ready'), 'used_up');
    expect(shown(gate)).toBe('used_up');
    // A re-render with the same reading changes nothing.
    expect(withReading(gate, 'ready')).toBe(gate);
    gate = withReading(gate, 'used_up');
    expect(shown(gate)).toBe('used_up');
  });

  it('opens the box again once the page reads the assistant as ready after a reset, without a reload', () => {
    let gate = refuse(startGate('ready'), 'used_up');
    gate = withReading(gate, 'used_up'); // the refresh after the refusal
    gate = withReading(gate, 'ready'); // the owner reset today's usage; the page reads it again
    expect(shown(gate)).toBe('ready');
  });

  it('opens the box again when a page that loaded used up reads ready', () => {
    let gate = startGate('used_up');
    expect(shown(gate)).toBe('used_up');
    gate = withReading(gate, 'ready');
    expect(shown(gate)).toBe('ready');
  });

  it('drops a "not set up" refusal once a model is chosen', () => {
    let gate = refuse(startGate('ready'), 'not_configured');
    gate = withReading(gate, 'not_configured');
    expect(shown(gate)).toBe('not_configured');
    gate = withReading(gate, 'ready');
    expect(shown(gate)).toBe('ready');
  });
});
