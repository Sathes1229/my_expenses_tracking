// Whether the question box shows. A plain module, so the rule is tested without React.

export type Availability = 'ready' | 'used_up' | 'not_configured';
export type Refusal = Exclude<Availability, 'ready'>;

/**
 * `reading` is the page's own reading from the server; `refused` is set when a send was refused
 * (the day's budget ran out, or the model was switched off) before the page has read it again.
 */
export type ChatGate = { reading: Availability; refused: Refusal | null };

export const startGate = (reading: Availability): ChatGate => ({ reading, refused: null });

export const refuse = (gate: ChatGate, why: Refusal): ChatGate => ({ ...gate, refused: why });

/**
 * A refusal holds until the page reads something different from the server (the refresh after it,
 * or coming back to the page, which Next keeps mounted). The newer reading wins from then on, so an
 * owner's reset of today's usage opens the box again without a reload.
 */
export const withReading = (gate: ChatGate, reading: Availability): ChatGate =>
  gate.reading === reading ? gate : startGate(reading);

export const shown = (gate: ChatGate): Availability => gate.refused ?? gate.reading;
