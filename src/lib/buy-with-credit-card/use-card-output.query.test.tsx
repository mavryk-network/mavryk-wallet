import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { getMoonPayCurrencies, getMoonPayBuyQuote } from 'lib/apis/moonpay';
import { createEntity } from 'lib/store';

import { getUpdatedFiatLimits } from './get-updated-fiat-limits';
import { TopUpProviderId } from './top-up-provider-id.enum';
import { getProviderLimitsQueryOptions } from './use-buy-with-credit-card.query';
import { useCardOutputQuery } from './use-card-output.query';

jest.mock('lib/apis/moonpay', () => ({ getMoonPayCurrencies: jest.fn(), getMoonPayBuyQuote: jest.fn() }));
jest.mock('lib/apis/temple', () => ({ getAliceBobPairsInfo: jest.fn() }));
jest.mock('lib/apis/temple/endpoints/alice-bob', () => ({ estimateAliceBobOutput: jest.fn() }));
jest.mock('lib/apis/utorg', () => ({ getCurrenciesInfo: jest.fn(), convertFiatAmountToCrypto: jest.fn() }));
jest.mock('app/store/buy-with-credit-card/utils', () => ({ mapMoonPayProviderCurrencies: (value: unknown) => value }));
jest.mock('./get-updated-fiat-limits', () => ({ getUpdatedFiatLimits: jest.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('deduplicates imperative limits and isolates late output responses while retaining refresh data/errors', async () => {
  const fiat = { code: 'USD', name: 'Dollar', icon: '', precision: 2 };
  const crypto = { code: 'MVRK', name: 'Mavryk', icon: '', precision: 6, slug: 'mav' };
  (getMoonPayCurrencies as jest.Mock).mockResolvedValue({ fiat: [fiat], crypto: [crypto] });
  let resolveLimits: (value: unknown) => void = () => undefined;
  (getUpdatedFiatLimits as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        resolveLimits = resolve;
      })
  );
  let resolveOld: (value: unknown) => void = () => undefined;
  (getMoonPayBuyQuote as jest.Mock).mockImplementation((_crypto: string, _fiat: string, amount: number) =>
    amount === 1
      ? new Promise(resolve => {
          resolveOld = resolve;
        })
      : Promise.resolve({ quoteCurrencyAmount: 20, totalAmount: 2 })
  );
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  let result: ReturnType<typeof useCardOutputQuery> | undefined;
  function Consumer({ amount }: { amount: number }) {
    result = useCardOutputQuery(TopUpProviderId.MoonPay, amount, fiat, crypto);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  const settle = async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
    });
  };
  const render = async (amount: number) => {
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Consumer amount={amount} />
        </QueryClientProvider>
      )
    );
    await settle();
  };
  await render(1);
  await settle();
  expect(getMoonPayBuyQuote).not.toHaveBeenCalled();
  let oldRequest: Promise<number | undefined> | undefined;
  let sharedLimits: Promise<unknown> | undefined;
  await act(async () => {
    oldRequest = result?.updateOutputAmount(1);
    sharedLimits = client.fetchQuery(
      getProviderLimitsQueryOptions('USD', 'MVRK', TopUpProviderId.MoonPay, fiat, crypto)
    );
  });
  expect(getUpdatedFiatLimits).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveLimits(createEntity({ min: 0, max: 100 }));
    await sharedLimits;
  });
  await render(2);
  await act(async () => {
    await result?.updateOutputAmount(2);
  });
  await settle();
  expect(result?.data).toBe(20);
  await act(async () => {
    resolveOld({ quoteCurrencyAmount: 10, totalAmount: 1 });
    await oldRequest;
  });
  await settle();
  expect(result?.data).toBe(20);
  (getMoonPayBuyQuote as jest.Mock).mockRejectedValue(new Error('offline'));
  await act(async () => {
    await result?.updateOutputAmount(2);
  });
  await settle();
  expect(result?.isError).toBe(true);
  expect(result?.data).toBe(20);
  await render(0);
  await act(async () => {
    await result?.updateOutputAmount(0);
  });
  await settle();
  expect(result?.data).toBe(0);
  expect(getUpdatedFiatLimits).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
  client.clear();
});
