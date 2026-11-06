import type { RwaPriceQuote, WalletRwaPricing } from 'mavryk/api/rwas';

import {
  getAvailableRwaMarketValueUsd,
  getAvailableRwaUsd,
  getNextRwaPricingExpiry,
  isValidRwaDecimals
} from './rwa-pricing.helpers';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const FUTURE = '2026-10-26T12:03:00Z';
const PAST = '2026-10-26T11:59:59Z';

const quote = (overrides: Partial<RwaPriceQuote> = {}): RwaPriceQuote => ({
  status: 'available',
  usd: '110.25',
  fxStatus: 'available',
  validUntil: FUTURE,
  executedAt: null,
  ...overrides
});

const pricing = (overrides: Partial<WalletRwaPricing> = {}): WalletRwaPricing => ({
  marketPrice: quote(),
  lastSale: quote({ usd: '108.50', executedAt: '2026-10-25T09:15:00Z' }),
  pricingValidUntil: FUTURE,
  marketValueUsd: '220.50',
  ...overrides
});

describe('getAvailableRwaUsd', () => {
  it('returns the USD value of a current available quote', () => {
    expect(getAvailableRwaUsd(quote(), FUTURE, NOW)?.toFixed()).toBe('110.25');
  });

  it('keeps "0" as a valid value', () => {
    expect(getAvailableRwaUsd(quote({ usd: '0' }), FUTURE, NOW)?.toFixed()).toBe('0');
  });

  it.each<[string, RwaPriceQuote | null | undefined, string | null | undefined]>([
    ['unavailable status', quote({ status: 'unavailable' }), FUTURE],
    ['stale fx', quote({ fxStatus: 'stale' }), FUTURE],
    ['not-applicable fx', quote({ fxStatus: 'not_applicable' }), FUTURE],
    ['null usd', quote({ usd: null }), FUTURE],
    ['non-numeric usd', quote({ usd: 'abc' }), FUTURE],
    ['missing quote', undefined, FUTURE],
    ['null quote', null, FUTURE],
    ['expired quote validUntil', quote({ validUntil: PAST }), FUTURE],
    ['missing quote validUntil', quote({ validUntil: null }), FUTURE],
    ['expired pricingValidUntil', quote(), PAST],
    ['missing pricingValidUntil', quote(), undefined],
    ['invalid timestamp', quote({ validUntil: 'not-a-date' }), FUTURE],
    ['expiry equal to now', quote({ validUntil: '2026-10-26T12:00:00Z' }), FUTURE]
  ])('returns null for %s', (_, value, pricingValidUntil) => {
    expect(getAvailableRwaUsd(value, pricingValidUntil, NOW)).toBeNull();
  });
});

describe('getAvailableRwaMarketValueUsd', () => {
  it('returns the supplied position value while the market price is current', () => {
    expect(getAvailableRwaMarketValueUsd(pricing(), NOW)?.toFixed()).toBe('220.5');
  });

  it('keeps a "0" position value', () => {
    expect(getAvailableRwaMarketValueUsd(pricing({ marketValueUsd: '0' }), NOW)?.toFixed()).toBe('0');
  });

  it.each<[string, WalletRwaPricing | undefined]>([
    ['missing pricing', undefined],
    ['null position value', pricing({ marketValueUsd: null })],
    ['unavailable market price', pricing({ marketPrice: quote({ status: 'unavailable' }) })],
    ['expired market price', pricing({ marketPrice: quote({ validUntil: PAST }) })],
    ['expired response pricing', pricing({ pricingValidUntil: PAST })]
  ])('returns null for %s', (_, value) => {
    expect(getAvailableRwaMarketValueUsd(value, NOW)).toBeNull();
  });
});

describe('getNextRwaPricingExpiry', () => {
  it('returns the earliest future expiry', () => {
    const earliest = '2026-10-26T12:01:00Z';
    expect(getNextRwaPricingExpiry(pricing({ lastSale: quote({ validUntil: earliest }) }), NOW)).toBe(
      Date.parse(earliest)
    );
  });

  it('ignores past, missing and invalid timestamps', () => {
    expect(
      getNextRwaPricingExpiry(
        pricing({ pricingValidUntil: PAST, marketPrice: quote({ validUntil: 'bad' }), lastSale: null }),
        NOW
      )
    ).toBeNull();
    expect(getNextRwaPricingExpiry(undefined, NOW)).toBeNull();
  });
});

describe('isValidRwaDecimals', () => {
  it.each([
    ['6', true],
    ['0', true],
    [undefined, false],
    ['', false],
    ['-1', false],
    ['6.5', false],
    ['abc', false]
  ])('%s → %s', (decimals, expected) => {
    expect(isValidRwaDecimals(decimals)).toBe(expected);
  });
});
