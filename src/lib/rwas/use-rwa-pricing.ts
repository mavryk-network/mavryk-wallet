import { useEffect, useMemo, useState } from 'react';

import type { WalletRwaPricing } from 'mavryk/api/rwas';

import { getAvailableRwaMarketValueUsd, getAvailableRwaUsd, getNextRwaPricingExpiry } from './rwa-pricing.helpers';

/** `setTimeout` overflows above this delay. */
const MAX_TIMEOUT_DELAY = 2_147_483_647;

/**
 * Derives the displayable USD values for an RWA and re-evaluates them when pricing expires,
 * so stale quotes stop rendering as current even if the next refetch fails.
 * Refetching itself stays with the detail-page batch interval.
 */
export function useRwaPricing(pricing: WalletRwaPricing | undefined) {
  const [expiryTick, setExpiryTick] = useState(0);

  const state = useMemo(() => {
    const now = Date.now();

    return {
      now,
      marketPriceUsd: getAvailableRwaUsd(pricing?.marketPrice, pricing?.pricingValidUntil, now),
      lastSaleUsd: getAvailableRwaUsd(pricing?.lastSale, pricing?.pricingValidUntil, now),
      marketValueUsd: getAvailableRwaMarketValueUsd(pricing, now)
    };
    // `expiryTick` re-reads the clock once the next expiry has passed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing, expiryTick]);

  // Timer that re-renders at the next pricing expiry so expired values flip to unavailable;
  // cleared when pricing changes or the page unmounts.
  useEffect(() => {
    const nextExpiry = getNextRwaPricingExpiry(pricing, state.now);
    if (nextExpiry === null) return;

    const timer = setTimeout(
      () => setExpiryTick(tick => tick + 1),
      Math.min(nextExpiry - state.now, MAX_TIMEOUT_DELAY)
    );

    return () => clearTimeout(timer);
  }, [pricing, state.now]);

  return state;
}
