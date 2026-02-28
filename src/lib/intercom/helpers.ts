const DEFAULT_ERROR_MESSAGE = 'Unexpected error occured';

export function serealizeError(err: any) {
  const message = err?.message || DEFAULT_ERROR_MESSAGE;
  return Array.isArray(err?.errors) && err.errors.length > 0 ? [message, err.errors] : message;
}

export function deserealizeError(data: any) {
  return Array.isArray(data) ? new IntercomError(data[0], data[1]) : new IntercomError(data);
}

export class IntercomError extends Error {
  override name: string = 'IntercomError';

  constructor(message: string, public errors?: any[]) {
    super(message);
  }
}
