// The common budgets a new household can start from. Plain module: the picker (client) imports it.
// Their names live in the catalogs, under starter.names.

export const STARTER_KEYS = [
  'groceries',
  'petrol',
  'eatingOut',
  'utilities',
  'phoneInternet',
  'school',
  'transport',
  'health',
] as const;

export type StarterKey = (typeof STARTER_KEYS)[number];

export const isStarterKey = (value: string): value is StarterKey => (STARTER_KEYS as readonly string[]).includes(value);
