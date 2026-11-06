import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { fetchFreshUsdToTokenRates, fetchFreshRWAToUsdtRates } from 'lib/apis/temple';
import { fetchFiatToTezosRates } from 'lib/fiat-currency';
import { exchangeRateKeys } from 'lib/query-keys';

import { useExchangeRatesQuery } from './use-exchange-rates.query';

jest.mock('lib/apis/temple', () => ({ fetchFreshUsdToTokenRates: jest.fn(), fetchFreshRWAToUsdtRates: jest.fn() }));
jest.mock('lib/fiat-currency', () => ({ fetchFiatToTezosRates: jest.fn() }));
jest.mock('app/store/root-state.selector', () => ({
  useSelector: (select: (state: unknown) => unknown) =>
    select({ currency: { usdToTokenRates: { data: {} }, fiatToTezosRates: { data: {} } } })
}));
jest.mock('lib/storage', () => ({ fetchFromStorage: jest.fn(async () => undefined) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('deduplicates drivers, publishes to readers and retains values when refresh fails', async () => {
  const token = (fetchFreshUsdToTokenRates as jest.MockedFunction<typeof fetchFreshUsdToTokenRates>).mockResolvedValue({
    mav: '2'
  });
  (fetchFreshRWAToUsdtRates as jest.MockedFunction<typeof fetchFreshRWAToUsdtRates>).mockResolvedValue({ rwa: '3' });
  const fiat = (fetchFiatToTezosRates as jest.MockedFunction<typeof fetchFiatToTezosRates>).mockResolvedValue({
    usd: 2
  });
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  let result: ReturnType<typeof useExchangeRatesQuery>;
  function Driver() {
    useExchangeRatesQuery(true);
    return null;
  }
  function Reader() {
    result = { ...useExchangeRatesQuery() };
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Reader />
      </QueryClientProvider>
    );
  });
  expect(token).not.toHaveBeenCalled();
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Reader />
        <Driver />
        <Driver />
      </QueryClientProvider>
    );
    await new Promise(resolve => setTimeout(resolve, 30));
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
  });
  expect(token).toHaveBeenCalledTimes(1);
  expect(result!.data).toEqual({ usdToTokenRates: { mav: '2', rwa: '3' }, fiatToTezosRates: { usd: 2 } });
  fiat.mockRejectedValue(new Error('offline'));
  await act(async () => {
    await client.invalidateQueries(exchangeRateKeys.all);
    await new Promise(resolve => setTimeout(resolve, 30));
  });
  expect(result!.isError).toBe(true);
  expect(result!.data?.usdToTokenRates.mav).toBe('2');
  act(() => root.unmount());
  client.clear();
});
