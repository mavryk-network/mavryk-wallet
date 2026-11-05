import axios from 'axios';

const REFRESH_TOKEN_REUSE_ERROR = 'REFRESH_TOKEN_REUSE';
const TOKEN_REVOKED_ERROR = 'Token has been revoked';

export function extractMavrykApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (responseData && typeof responseData === 'object') {
      const values = Object.values(responseData).filter((value): value is string => typeof value === 'string');
      if (values.length > 0) return values.join(', ');
    }

    if (typeof error.response?.status === 'number') {
      return `Mavryk API request failed with status ${error.response.status}`;
    }
  }

  if (error instanceof Error && error.message) return error.message;

  return 'Mavryk API request failed';
}

/**
 * Wallet API failure that keeps the HTTP status, backend `code` and `Retry-After` delay, so callers can tell
 * validation, rate-limit, availability and transport failures apart. The message matches
 * `extractMavrykApiErrorMessage`.
 */
export class MavrykApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;
  readonly isCancelled: boolean;

  constructor(
    message: string,
    options: { status?: number; code?: string; retryAfterSeconds?: number; isCancelled?: boolean; cause?: unknown } = {}
  ) {
    super(message);
    // Keeps `instanceof` working when Error subclasses are transpiled to ES5.
    Object.setPrototypeOf(this, MavrykApiError.prototype);
    this.name = 'MavrykApiError';
    this.status = options.status;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.isCancelled = options.isCancelled ?? false;
    (this as { cause?: unknown }).cause = options.cause;
  }
}

/**
 * Reads a `Retry-After` delay in whole seconds from axios/fetch response headers.
 * Supports both delta-seconds and HTTP-date forms; returns undefined when absent or invalid.
 */
export function getRetryAfterSeconds(headers: unknown, now = Date.now()) {
  const value =
    headers && typeof (headers as Headers).get === 'function'
      ? (headers as Headers).get('retry-after')
      : headers && typeof headers === 'object'
      ? (headers as Record<string, unknown>)['retry-after'] ?? (headers as Record<string, unknown>)['Retry-After']
      : undefined;

  if (typeof value !== 'string' && typeof value !== 'number') return undefined;

  const trimmed = String(value).trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;

  return Math.max(0, Math.ceil((date - now) / 1000));
}

/** Converts any Wallet API failure into a `MavrykApiError`, preserving status, code and retry metadata. */
export function toMavrykApiError(error: unknown) {
  if (error instanceof MavrykApiError) return error;

  const message = extractMavrykApiErrorMessage(error);

  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const code =
      responseData && typeof responseData === 'object' && typeof (responseData as { code?: unknown }).code === 'string'
        ? (responseData as { code: string }).code
        : undefined;

    return new MavrykApiError(message, {
      status: error.response?.status,
      code,
      retryAfterSeconds: getRetryAfterSeconds(error.response?.headers),
      isCancelled: axios.isCancel(error) || error.code === 'ERR_CANCELED',
      cause: error
    });
  }

  return new MavrykApiError(message, {
    isCancelled: error instanceof Error && error.name === 'AbortError',
    cause: error
  });
}

export type SafeLogError = { status?: number; message: string };

/**
 * Reduces an error to fields that are safe to log.
 * Axios errors carry the request `config` (body, headers), so logging them raw can leak refresh tokens,
 * signatures or bearer headers. Only the HTTP status and a readable message are kept.
 *
 * @param error any thrown value
 * @returns `{ status, message }` without request data
 */
export function toSafeLogError(error: unknown): SafeLogError {
  const message = extractMavrykApiErrorMessage(error);

  if (axios.isAxiosError(error) && typeof error.response?.status === 'number') {
    return { status: error.response.status, message };
  }

  return { message };
}

export function isTerminalMavrykAuthError(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) {
    return false;
  }

  return (
    responseContainsAuthError(error.response.data, REFRESH_TOKEN_REUSE_ERROR) ||
    responseContainsAuthError(error.response.data, TOKEN_REVOKED_ERROR)
  );
}

function responseContainsAuthError(data: unknown, expected: string): boolean {
  if (typeof data === 'string') {
    return data.includes(expected);
  }

  if (Array.isArray(data)) {
    return data.some(item => responseContainsAuthError(item, expected));
  }

  if (data && typeof data === 'object') {
    return Object.values(data).some(value => responseContainsAuthError(value, expected));
  }

  return false;
}
