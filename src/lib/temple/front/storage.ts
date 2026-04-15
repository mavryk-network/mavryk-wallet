import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isDefined } from '@rnw-community/shared';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import browser, { Storage } from 'webextension-polyfill';

import { storageKeys } from 'lib/query-keys';
import { fetchFromStorage, putToStorage } from 'lib/storage';
import { useDidUpdate } from 'lib/ui/hooks';

export function useStorage<T = any>(key: string): [T | null | undefined, (val: SetStateAction<T>) => Promise<void>];
export function useStorage<T = any>(key: string, fallback: T): [T, (val: SetStateAction<T>) => Promise<void>];
export function useStorage<T = any>(key: string, fallback?: T) {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery<T | null>({
    queryKey: storageKeys.one(key),
    queryFn: () => fetchFromStorage<T>(key),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    retry: 2
  });

  useEffect(
    () =>
      onStorageChanged(key, (newValue: T) => {
        queryClient.setQueryData(storageKeys.one(key), newValue);
      }),
    [key, queryClient]
  );

  const value = fallback === undefined ? data : data ?? fallback;
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const setValue = useCallback(
    async (val: SetStateAction<T>) => {
      const nextValue = typeof val === 'function' ? (val as any)(valueRef.current) : val;
      await putToStorage(key, nextValue);
      valueRef.current = nextValue;
      queryClient.setQueryData(storageKeys.one(key), nextValue);
    },
    [key, queryClient]
  );
  return useMemo(() => [value, setValue], [value, setValue]);
}

export function usePassiveStorage<T = any>(key: string): [T | null | undefined, Dispatch<SetStateAction<T>>];
export function usePassiveStorage<T = any>(
  key: string,
  fallback: T,
  shouldPutFallback?: boolean
): [T, Dispatch<SetStateAction<T>>];
export function usePassiveStorage<T = any>(key: string, fallback?: T, shouldPutFallback = false) {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery<T | null>({
    queryKey: storageKeys.one(key),
    queryFn: () => fetchFromStorage<T>(key),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    retry: 2
  });

  useEffect(
    () =>
      onStorageChanged(key, (newValue: T) => {
        queryClient.setQueryData(storageKeys.one(key), newValue);
      }),
    [key, queryClient]
  );

  const finalData = fallback === undefined ? data : data ?? fallback;

  const [value, setValue] = useState(finalData);

  useEffect(() => {
    if (!isDefined(data) && isDefined(fallback) && shouldPutFallback) {
      putToStorage(key, fallback);
    }
  }, [data, fallback, key, shouldPutFallback]);

  useDidUpdate(() => {
    setValue(finalData);
  }, [finalData]);

  const updateValue = useCallback(
    (newValue: T | null | undefined) => {
      const newValueWithFallback = fallback === undefined ? newValue : newValue ?? fallback;
      putToStorage(key, newValueWithFallback);
      setValue(newValueWithFallback as T | null);
    },
    [fallback, key]
  );

  return [value, updateValue];
}

function onStorageChanged<T = any>(key: string, callback: (newValue: T) => void) {
  const handleChanged = (
    changes: {
      [s: string]: Storage.StorageChange;
    },
    areaName: string
  ) => {
    if (areaName === 'local' && key in changes) {
      callback(changes[key].newValue);
    }
  };
  browser.storage.onChanged.addListener(handleChanged);
  return () => browser.storage.onChanged.removeListener(handleChanged);
}
