import type { ZodError } from 'zod';

/** Сервер ответил HTTP-ошибкой (status >= 400) */
export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly details?: unknown,
  ) {
    super(`HTTP ${status}: ${url}`);
    this.name = 'ApiHttpError';
  }
}

/** Ответ (или query) не прошёл валидацию Zod-схемой */
export class ApiValidationError extends Error {
  constructor(
    readonly url: string,
    readonly zodError: ZodError,
  ) {
    super(`Validation failed for ${url}`);
    this.name = 'ApiValidationError';
  }
}
