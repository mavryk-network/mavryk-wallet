import { useCallback, useState } from 'react';

type LoadingStatus = 'idle' | 'loading' | 'error';

export const useLoading = () => {
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const start = useCallback(() => {
    setStatus('loading');
    setError(null);
  }, []);

  const stop = useCallback(() => {
    setStatus('idle');
  }, []);

  const fail = useCallback((err: Error) => {
    setStatus('error');
    setError(err);
  }, []);

  // Auto wrapper for async functions
  const wrap = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        start();
        const res = await fn();
        stop();
        return res;
      } catch (e) {
        fail(e as Error);
        throw e;
      }
    },
    [start, stop, fail]
  );

  return {
    status,
    isLoading: status === 'loading',
    isError: status === 'error',
    error,

    start,
    stop,
    fail,
    wrap
  };
};
