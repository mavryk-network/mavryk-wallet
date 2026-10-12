import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { getMoonPayCurrencies } from 'lib/apis/moonpay';
import { buyCardKeys } from 'lib/query-keys';
import { createEntity } from 'lib/store';

import { getUpdatedFiatLimits } from './get-updated-fiat-limits';
import { TopUpProviderId } from './top-up-provider-id.enum';
import {
  useAllCachedPairLimits,
  useProviderLimits,
  useProviderCurrenciesQuery
} from './use-buy-with-credit-card.query';

jest.mock('lib/apis/moonpay', () => ({ getMoonPayCurrencies: jest.fn() }));
jest.mock('lib/apis/temple', () => ({ getAliceBobPairsInfo: jest.fn() }));
jest.mock('lib/apis/utorg', () => ({ getCurrenciesInfo: jest.fn() }));
jest.mock('app/store/buy-with-credit-card/utils', () => ({
  mapMoonPayProviderCurrencies: (data: unknown) => data,
  mapUtorgProviderCurrencies: (data: unknown) => data,
  mapAliceBobProviderCurrencies: (data: unknown) => data
}));
jest.mock('./get-updated-fiat-limits', () => ({ getUpdatedFiatLimits: jest.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('gates limits on catalogs, deduplicates consumers, isolates pairs and preserves cached data on failure', async () => {
  const fetchCatalog = getMoonPayCurrencies as jest.Mock;
  const fetchLimits = getUpdatedFiatLimits as jest.Mock;
  let finishCatalog: (value: unknown) => void = () => undefined;
  fetchCatalog.mockImplementation(
    () =>
      new Promise(resolve => {
        finishCatalog = resolve;
      })
  );
  fetchLimits.mockResolvedValue(createEntity({ min: 5, max: 10 }));
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  let result: ReturnType<typeof useProviderLimits> | undefined;
  let pairs: ReturnType<typeof useAllCachedPairLimits> = {};
  function Consumer({ fiat }: { fiat: string }) {
    result = useProviderLimits(fiat, 'MVRK', TopUpProviderId.MoonPay);
    useProviderCurrenciesQuery(TopUpProviderId.MoonPay);
    pairs = useAllCachedPairLimits();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  const render = async (fiat: string) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Consumer fiat={fiat} />
          <Consumer fiat={fiat} />
        </QueryClientProvider>
      );
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  };
  const settle = async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
  };
  await render('USD');
  expect(fetchCatalog).toHaveBeenCalledTimes(1);
  expect(fetchLimits).not.toHaveBeenCalled();
  await act(async () => {
    finishCatalog({ fiat: [{ code: 'USD' }], crypto: [{ code: 'MVRK' }] });
  });
  await settle();
  await settle();
  expect(fetchLimits).toHaveBeenCalledTimes(1);
  expect(result?.data).toEqual({ min: 5, max: 10 });
  expect(pairs.USD.MVRK[TopUpProviderId.MoonPay].data).toEqual(result?.data);
  await act(async () => {
    client.setQueryData(buyCardKeys.limits('USD', 'MVRK', TopUpProviderId.MoonPay, [null, null]), {
      min: 999,
      max: 1000
    });
  });
  await settle();
  expect(pairs.USD.MVRK[TopUpProviderId.MoonPay].data).toEqual({ min: 5, max: 10 });
  fetchLimits.mockResolvedValue(createEntity(undefined, false, 'offline'));
  await act(async () => {
    await client.invalidateQueries(['buy-card', 'limits', 'USD', 'MVRK']);
  });
  await settle();
  expect(result?.error).toBe('offline');
  expect(result?.data).toEqual({ min: 5, max: 10 });
  await render('EUR');
  await settle();
  expect(result?.data).toBeUndefined();
  expect(result?.error).toBeDefined();
  expect(buyCardKeys.currencies(TopUpProviderId.Utorg)).not.toEqual(buyCardKeys.currencies(TopUpProviderId.MoonPay));
  act(() => root.unmount());
  client.clear();
});

it('keeps a late response for the previous pair out of the selected pair', async () => {
  (getMoonPayCurrencies as jest.Mock).mockResolvedValue({
    fiat: [{ code: 'USD' }, { code: 'EUR' }],
    crypto: [{ code: 'MVRK' }]
  });
  let resolveUsd: (value: unknown) => void = () => undefined;
  (getUpdatedFiatLimits as jest.Mock).mockImplementation((fiat: { code: string }) =>
    fiat.code === 'USD'
      ? new Promise(resolve => {
          resolveUsd = resolve;
        })
      : Promise.resolve(createEntity({ min: 2, max: 4 }))
  );
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  let result: ReturnType<typeof useProviderLimits> | undefined;
  function Consumer({ fiat }: { fiat: string }) {
    result = useProviderLimits(fiat, 'MVRK', TopUpProviderId.MoonPay);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  const render = async (fiat: string) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Consumer fiat={fiat} />
        </QueryClientProvider>
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
    });
  };
  await render('USD');
  expect(result?.isLoading).toBe(true);
  await render('EUR');
  expect(result?.data).toEqual({ min: 2, max: 4 });
  await act(async () => {
    resolveUsd(createEntity({ min: 100, max: 200 }));
    await new Promise(resolve => setTimeout(resolve, 25));
  });
  expect(result?.data).toEqual({ min: 2, max: 4 });
  act(() => root.unmount());
  client.clear();
});
