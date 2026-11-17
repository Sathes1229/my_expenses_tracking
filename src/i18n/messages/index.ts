import type { Locale } from '../locale';
import { en } from './en';
import { ms } from './ms';

type Strings<T> = { [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };

/** The shape of every catalog: the English one, with each text widened to string. */
export type Messages = Strings<typeof en>;

export const messages: Record<Locale, Messages> = { en, ms };
