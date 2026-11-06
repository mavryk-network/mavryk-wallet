import { parseWalletRwaAssets, walletRwaAssetToDetails } from './rwas';

jest.mock('@vespaiach/axios-fetch-adapter', () => jest.fn());

const unavailableQuote = (method: string, reason: string) => ({
  method,
  status: 'unavailable',
  reason,
  price: null,
  usd: null,
  nativeQuote: 'usdt',
  asOf: null,
  validUntil: null,
  fxStatus: 'not_applicable',
  fxAt: null
});

/** Trimmed rows from a live `/wallets/{address}/assets` response. */
const OCEAN = {
  marketPrice: unavailableQuote('orderbook_mid', 'unsupported_identity'),
  lastSale: { ...unavailableQuote('last_trade', 'unsupported_identity'), executedAt: null },
  primaryIssuance: null,
  pricingObservedAt: '2026-10-27T15:49:39.435758Z',
  pricingValidUntil: '2026-10-27T15:52:39.435758Z',
  marketValueUsd: null,
  address: 'KT1PXS6bacaVGHHWCQtvNSvoGL9Daho3ozcp',
  symbol: 'OCEAN',
  name: 'OCEAN Token',
  balance: 1000902.358,
  usdValue: 0,
  price: { timestamp: '2026-10-27T15:50:45.10814569Z', usd: 0 },
  metadata: {
    description: 'Coastal hospitality and marina-adjacent retail bundle.',
    name: 'OCEAN Token',
    symbol: 'OCEAN',
    decimals: '6',
    shouldPreferSymbol: 'true'
  }
};

const KRKN = {
  marketPrice: unavailableQuote('orderbook_mid', 'primary_market'),
  lastSale: { ...unavailableQuote('last_trade', 'primary_market'), executedAt: null },
  primaryIssuance: {
    method: 'primary_list_price',
    status: 'available',
    reason: null,
    price: '30',
    usd: '30',
    nativeQuote: 'usdt',
    asOf: '2026-10-27T15:49:41.511136Z',
    validUntil: '2026-10-27T15:52:41.511136Z',
    fxStatus: 'available',
    fxAt: '2026-10-27T15:20:00Z',
    launchId: 3,
    launchStatus: 'active',
    active: true
  },
  pricingValidUntil: '2026-10-27T15:52:41.511136Z',
  marketValueUsd: null,
  address: 'KT19PyrK3NKTiAfjxPJwhswgzkiMeQuawkFc',
  symbol: 'KRKN',
  name: 'Kraken',
  balance: 18.345996,
  metadata: { name: 'Kraken', symbol: 'KRKN', decimals: '6' }
};

/** A holding without CRM metadata or pricing fields. */
const BARE = { address: 'KT1NbgrAUjxgvm4b72VEYPp7r8KXTLgXNjjP', balance: 2.626 };

describe('parseWalletRwaAssets', () => {
  it('keeps every holding, including ones with unavailable or missing pricing', () => {
    const assets = parseWalletRwaAssets([OCEAN, KRKN, BARE]);

    expect(assets.map(asset => asset.address)).toEqual([OCEAN.address, KRKN.address, BARE.address]);
  });

  it('normalizes missing pricing fields to null', () => {
    const [bare] = parseWalletRwaAssets([BARE]);

    expect(bare).toMatchObject({ marketPrice: null, lastSale: null, pricingValidUntil: null, marketValueUsd: null });
  });

  it('keeps money as decimal strings, including "0" and numeric payloads', () => {
    const [asset] = parseWalletRwaAssets([
      {
        ...BARE,
        marketValueUsd: '0',
        marketPrice: { status: 'available', usd: 110.25, fxStatus: 'available', validUntil: OCEAN.pricingValidUntil }
      }
    ]);

    expect(asset.marketValueUsd).toBe('0');
    expect(asset.marketPrice).toMatchObject({ usd: '110.25', executedAt: null });
  });

  it('degrades malformed pricing to null instead of rejecting the response', () => {
    const [asset] = parseWalletRwaAssets([
      { ...BARE, marketPrice: 'broken', lastSale: { status: 42 }, pricingValidUntil: 7, marketValueUsd: {} }
    ]);

    expect(asset).toMatchObject({ marketPrice: null, lastSale: null, pricingValidUntil: null, marketValueUsd: null });
  });
});

describe('walletRwaAssetToDetails', () => {
  it('maps description and wallet-row pricing, never primary issuance', () => {
    const [ocean, krkn] = parseWalletRwaAssets([OCEAN, KRKN]).map(walletRwaAssetToDetails);

    expect(ocean.description).toBe(OCEAN.metadata.description);
    expect(ocean.pricing).toEqual({
      marketPrice: { status: 'unavailable', usd: null, fxStatus: 'not_applicable', validUntil: null, executedAt: null },
      lastSale: { status: 'unavailable', usd: null, fxStatus: 'not_applicable', validUntil: null, executedAt: null },
      pricingValidUntil: OCEAN.pricingValidUntil,
      marketValueUsd: null
    });
    expect(krkn.pricing.marketPrice?.usd).toBeNull();
    expect(JSON.stringify(krkn)).not.toContain('primary_list_price');
  });

  it('maps a holding without metadata to an empty description and no decimals', () => {
    const [bare] = parseWalletRwaAssets([BARE]).map(walletRwaAssetToDetails);

    expect(bare).toMatchObject({ description: '', decimals: undefined, pricing: { marketPrice: null } });
  });
});
