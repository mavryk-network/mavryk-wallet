import { useMemo, useSyncExternalStore, useCallback } from 'react';

import { notifyManager, useQuery, useQueryClient } from '@tanstack/react-query';

import { BuyWithCreditCardState, TopUpProviderCurrencies } from 'app/store/buy-with-credit-card/state';
import {
  mapAliceBobProviderCurrencies,
  mapMoonPayProviderCurrencies,
  mapUtorgProviderCurrencies
} from 'app/store/buy-with-credit-card/utils';
import { getMoonPayCurrencies } from 'lib/apis/moonpay';
import { getAliceBobPairsInfo } from 'lib/apis/temple';
import { getCurrenciesInfo } from 'lib/apis/utorg';
import { buyCardKeys } from 'lib/query-keys';
import { createEntity } from 'lib/store';

import { PAIR_NOT_FOUND_MESSAGE } from './constants';
import { getUpdatedFiatLimits } from './get-updated-fiat-limits';
import { TopUpProviderId } from './top-up-provider-id.enum';
import { TopUpProviderPairLimits } from './topup.interface';

const POLICY = {
  staleTime: 20_000,
  cacheTime: 5 * 60_000,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false
} as const;
export const TOP_UP_PROVIDER_IDS = [TopUpProviderId.MoonPay, TopUpProviderId.Utorg, TopUpProviderId.AliceBob];
const EMPTY_CURRENCIES: TopUpProviderCurrencies = { fiat: [], crypto: [] };

/** Each public provider catalog has independent errors and cache ownership. */
export async function fetchProviderCurrencies(provider: TopUpProviderId): Promise<TopUpProviderCurrencies> {
  switch (provider) {
    case TopUpProviderId.MoonPay:
      return mapMoonPayProviderCurrencies(await getMoonPayCurrencies());
    case TopUpProviderId.Utorg:
      return mapUtorgProviderCurrencies(await getCurrenciesInfo());
    case TopUpProviderId.AliceBob:
      return mapAliceBobProviderCurrencies(await getAliceBobPairsInfo(false));
  }
}

export const useProviderCurrenciesQuery = (provider: TopUpProviderId) =>
  useQuery({
    ...POLICY,
    queryKey: buyCardKeys.currencies(provider),
    queryFn: () => fetchProviderCurrencies(provider)
  });

/** A view adapter only; no result is copied to Redux or a durable store. */
export const useProviderCurrencies = (provider: TopUpProviderId) => {
  const query = useProviderCurrenciesQuery(provider);
  return useMemo(
    () =>
      createEntity(
        query.data ?? EMPTY_CURRENCIES,
        query.isFetching,
        query.isError ? 'Provider currencies loading failed' : undefined
      ),
    [query.data, query.isFetching, query.isError]
  );
};

/** Catalog limits affect the response and are therefore included alongside the selected pair. */
export const useProviderLimitsQuery = (fiat: string, crypto: string, provider: TopUpProviderId) => {
  const catalog = useProviderCurrenciesQuery(provider);
  const fiatCurrency = catalog.data?.fiat.find(item => item.code === fiat);
  const cryptoCurrency = catalog.data?.crypto.find(item => item.code === crypto);
  return useQuery({
    ...POLICY,
    queryKey: buyCardKeys.limits(fiat, crypto, provider, [fiatCurrency ?? null, cryptoCurrency ?? null]),
    enabled: Boolean(catalog.data && fiat && crypto),
    queryFn: async () => {
      if (!fiatCurrency || !cryptoCurrency) throw new Error(PAIR_NOT_FOUND_MESSAGE);
      const result = await getUpdatedFiatLimits(fiatCurrency, cryptoCurrency, provider);
      if (result.error) throw new Error(result.error);
      if (!result.data) throw new Error('Provider limits unavailable');
      return result.data;
    }
  });
};

export const useProviderLimits = (fiat: string, crypto: string, provider: TopUpProviderId) => {
  const query = useProviderLimitsQuery(fiat, crypto, provider);
  return useMemo(
    () => createEntity(query.data, query.isFetching, query.error instanceof Error ? query.error.message : undefined),
    [query.data, query.isFetching, query.error]
  );
};

/** Subscribe to cached pairs for currency menus and imperative form selections without extra requests. */
export function useAllCachedPairLimits(): BuyWithCreditCardState['pairLimits'] {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  const subscribe = useCallback((notify: () => void) => cache.subscribe(notifyManager.batchCalls(notify)), [cache]);
  const snapshot = useSyncExternalStore(subscribe, () =>
    JSON.stringify(
      cache
        .findAll(buyCardKeys.all)
        .map(query => [
          query.queryHash,
          query.state.dataUpdateCount,
          query.state.errorUpdateCount,
          query.state.fetchStatus
        ])
    )
  );
  return useMemo(() => {
    // The external-store revision invalidates this derived view; cached catalogs choose the matching input version.
    void snapshot;
    const pairs: BuyWithCreditCardState['pairLimits'] = {};
    for (const query of cache.findAll(['buy-card', 'limits'])) {
      const [, , fiat, crypto, providerKey] = query.queryKey;
      const provider = TOP_UP_PROVIDER_IDS.find(id => id === providerKey);
      if (typeof fiat !== 'string' || typeof crypto !== 'string' || !provider) continue;
      const catalog = client.getQueryData<TopUpProviderCurrencies>(buyCardKeys.currencies(provider));
      const inputs = [
        catalog?.fiat.find(item => item.code === fiat) ?? null,
        catalog?.crypto.find(item => item.code === crypto) ?? null
      ];
      if (JSON.stringify(query.queryKey) !== JSON.stringify(buyCardKeys.limits(fiat, crypto, provider, inputs)))
        continue;
      const pair = (pairs[fiat] ??= {});
      const limits = (pair[crypto] ??= {
        [TopUpProviderId.MoonPay]: createEntity(undefined),
        [TopUpProviderId.Utorg]: createEntity(undefined),
        [TopUpProviderId.AliceBob]: createEntity(undefined)
      });
      limits[provider] = createEntity(
        client.getQueryData<TopUpProviderPairLimits>(query.queryKey),
        query.state.fetchStatus === 'fetching',
        query.state.error instanceof Error ? query.state.error.message : undefined
      );
    }
    return pairs;
  }, [cache, client, snapshot]);
}

/** Refresh only card catalogs and the current pair; Query deduplicates mounted consumers. */
export const useRefreshCardData = () => {
  const client = useQueryClient();
  return useCallback(
    async (fiat: string, crypto: string) => {
      await client.invalidateQueries(['buy-card', 'currencies']);
      await client.invalidateQueries(['buy-card', 'limits', fiat, crypto]);
    },
    [client]
  );
};
