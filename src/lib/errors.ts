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

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
  }
}

/** The viewer is signed in but their role does not allow this. */
export class ForbiddenError extends AppError {
  constructor(message = 'You are not allowed to do that.') {
    super('forbidden', message);
    this.name = 'ForbiddenError';
  }
}

/** Input that cannot be saved. `field` names the form field the message belongs under. */
export class ValidationError extends AppError {
  readonly field: string;

  constructor(field: string, message: string) {
    super('bad_request', message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
