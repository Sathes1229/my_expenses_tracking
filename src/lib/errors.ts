import { fmt } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { messages, type Messages } from '@/i18n/messages';

export type AppErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited';

const STATUS: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
};

/** A message in the errors catalog, with the values for its {placeholders}. */
export type ErrorKey = keyof Messages['errors'];
export type ErrorParams = Record<string, string | number>;
export type Problem = { key: ErrorKey; params?: ErrorParams };

export function problemText(problem: Problem, locale: Locale = 'en'): string {
  return fmt(messages[locale].errors[problem.key], problem.params);
}

const asProblem = (problem: ErrorKey | Problem, params?: ErrorParams): Problem =>
  typeof problem === 'string' ? { key: problem, params } : problem;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Set when the message comes from the catalog, so it can be shown in the viewer's language. */
  readonly problem?: Problem;

  constructor(code: AppErrorCode, message: string | Problem) {
    // The English text stays the message, for logs and for code that reads it.
    super(typeof message === 'string' ? message : problemText(message));
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    if (typeof message !== 'string') this.problem = message;
  }
}

/** The viewer is signed in but their role does not allow this. */
export class ForbiddenError extends AppError {
  constructor(problem: ErrorKey | Problem = 'notAllowed', params?: ErrorParams) {
    super('forbidden', asProblem(problem, params));
    this.name = 'ForbiddenError';
  }
}

/** Input that cannot be saved. `field` names the form field the message belongs under. */
export class ValidationError extends AppError {
  readonly field: string;

  constructor(field: string, problem: ErrorKey | Problem, params?: ErrorParams) {
    super('bad_request', asProblem(problem, params));
    this.name = 'ValidationError';
    this.field = field;
  }
}

/** What to show the viewer: the catalog text in their language, or the message as it is. */
export function errorText(error: AppError, locale: Locale): string {
  return error.problem ? problemText(error.problem, locale) : error.message;
}

/** A catalog message in the given language, for checks that return text rather than throw. */
export function say(locale: Locale, key: ErrorKey, params?: ErrorParams): string {
  return problemText({ key, params }, locale);
}

/** The text of a check helper's result (passwordError and the like), or null when it passed. */
export function checkText(problem: Problem | null, locale: Locale): string | null {
  return problem ? problemText(problem, locale) : null;
}
