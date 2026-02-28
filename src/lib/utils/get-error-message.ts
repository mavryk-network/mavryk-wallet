/**
 * Type-safe error message extraction.
 * Handles Error instances, strings, objects with .message, and unknown values.
 */
export const getErrorMessage = (err: unknown, fallback = 'Something went wrong'): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (
    err !== null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
};
