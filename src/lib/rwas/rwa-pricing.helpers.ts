import BigNumber from 'bignumber.js';

import type { RwaPriceQuote, WalletRwaPricing } from 'mavryk/api/rwas';

const AVAILABLE_STATUS = 'available';

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
};

const isFutureTimestamp = (value: string | null | undefined, now: number) => {
  const timestamp = toTimestamp(value);

  return timestamp !== null && timestamp > now;
};

const toDecimal = (value: string | null | undefined) => {
  if (value === null || value === undefined) return null;
  const decimal = new BigNumber(value);

  return decimal.isFinite() ? decimal : null;
};

/**
 * Returns a quote's USD value only while it is current: both statuses are `available`,
 * `usd` is present, and the quote and response expiry are valid future timestamps.
 * @returns the USD value, or `null` when it must render as unavailable
 */
export function getAvailableRwaUsd(
  quote: RwaPriceQuote | null | undefined,
  pricingValidUntil: string | null | undefined,
  now: number
): BigNumber | null {
  if (!quote || quote.status !== AVAILABLE_STATUS || quote.fxStatus !== AVAILABLE_STATUS) return null;
  if (!isFutureTimestamp(quote.validUntil, now) || !isFutureTimestamp(pricingValidUntil, now)) return null;

  return toDecimal(quote.usd);
}

/**
 * Returns the supplied position value while the market price is current; it is never recalculated.
 * @returns the USD position value, or `null` when unavailable
 */
export function getAvailableRwaMarketValueUsd(pricing: WalletRwaPricing | undefined, now: number): BigNumber | null {
  if (!pricing || !getAvailableRwaUsd(pricing.marketPrice, pricing.pricingValidUntil, now)) return null;

  return toDecimal(pricing.marketValueUsd);
}

/**
 * Finds the next moment a displayed price stops being current.
 * @returns the earliest future expiry in milliseconds, or `null` when nothing is pending
 */
export function getNextRwaPricingExpiry(pricing: WalletRwaPricing | undefined, now: number): number | null {
  if (!pricing) return null;

  const expiries = [pricing.pricingValidUntil, pricing.marketPrice?.validUntil, pricing.lastSale?.validUntil]
    .map(toTimestamp)
    .filter((timestamp): timestamp is number => timestamp !== null && timestamp > now);

  return expiries.length ? Math.min(...expiries) : null;
}

/** `metadata.decimals` must be a non-negative integer string for a normalized balance to be shown. */
export const isValidRwaDecimals = (decimals: string | undefined): decimals is string =>
  decimals !== undefined && /^\d+$/.test(decimals);
