import { MAV_TOKEN_SLUG } from 'lib/assets';
import { fetchFromStorage } from 'lib/storage';
import { TempleAccountType, TempleChainId } from 'lib/temple/types';
import { mavrykApi } from 'mavryk/api/client';
import { fetchWalletHistory } from 'mavryk/api/history';

import { MVRK_HISTORY_TOKEN_ADDRESS } from './consts';
import fetchUserHistory, {
  fetchUserOperationByHash,
  isFullOperationHash,
  normalizeRecentOperationsItems,
  WATCH_ONLY_ASSET_HISTORY_UNSUPPORTED
} from './fetch';
import { PAYMENT_ASSET, PURCHASE_ASSET, PURCHASE_DECIMALS, PURCHASE_WALLET, purchaseFixture } from './purchase.fixture';
import { refundFixture, REFUND_TOKEN, REFUND_WALLET } from './refund.fixture';

jest.mock('mavryk/api/client', () => ({ mavrykApi: { get: jest.fn() } }));
jest.mock('lib/storage', () => ({ fetchFromStorage: jest.fn().mockResolvedValue([]), putToStorage: jest.fn() }));
jest.mock('lib/apis/tzkt', () => ({ isKnownChainId: jest.fn() }));
jest.mock('lib/metadata', () => ({ useAssetMetadata: jest.fn() }));
jest.mock('lib/apis/temple', () => ({ METADATA_API_LOAD_CHUNK_SIZE: 50, templeWalletApi: {} }));
jest.mock('lib/apis/temple/endpoints/templewallet.api', () => ({ templeWalletApi: {} }));

beforeEach(() => {
  jest.clearAllMocks();
  (mavrykApi.get as jest.Mock).mockResolvedValue({
    data: { walletAddress: PURCHASE_WALLET, operations: [purchaseFixture()], cursor: 65453114261504, hasMore: true }
  });
});

it.each([
  [undefined, 'history'],
  [MAV_TOKEN_SLUG, 'tokens/mv2ZZZZZZZZZZZZZZZZZZZZZZZZZZZDXMF2d/history'],
  [`${PURCHASE_ASSET}_0`, `tokens/${PURCHASE_ASSET}/history`],
  [`${PURCHASE_ASSET}_42`, `tokens/${PURCHASE_ASSET}/history`]
])('routes history and hash lookup for %s to the correct endpoint', async (assetSlug, endpoint) => {
  (mavrykApi.get as jest.Mock).mockResolvedValue({
    data: { walletAddress: PURCHASE_WALLET, operations: [], cursor: 123, hasMore: true }
  });

  for (const cursor of [undefined, 456]) {
    const result = await fetchUserHistory(
      TempleChainId.Basenet,
      { publicKeyHash: PURCHASE_WALLET } as Parameters<typeof fetchUserHistory>[1],
      assetSlug,
      20,
      {} as Parameters<typeof fetchUserHistory>[4],
      cursor,
      { sender: PURCHASE_WALLET }
    );
    expect(mavrykApi.get).toHaveBeenLastCalledWith(`/wallets/${PURCHASE_WALLET}/${endpoint}`, {
      _authContext: expect.objectContaining({ walletAddress: PURCHASE_WALLET }),
      params: { cursor, search: undefined, filter: 'sent', limit: 20, token_id: assetSlug?.split('_')[1] }
    });
    expect(result).toEqual({ items: [], cursor: 123, hasMore: true });
  }

  await fetchUserOperationByHash(TempleChainId.Basenet, PURCHASE_WALLET, 'operation-hash', assetSlug);
  expect(mavrykApi.get).toHaveBeenLastCalledWith(`/wallets/${PURCHASE_WALLET}/${endpoint}`, {
    _authContext: expect.objectContaining({ walletAddress: PURCHASE_WALLET }),
    params: {
      cursor: undefined,
      search: 'operation-hash',
      filter: undefined,
      limit: 20,
      token_id: assetSlug?.split('_')[1]
    }
  });
});

it('parses the real envelope and enriches both paginated wallet history and hash search', async () => {
  const decimals = jest.fn().mockResolvedValue(PURCHASE_DECIMALS);
  const result = await fetchUserHistory(
    TempleChainId.Basenet,
    { publicKeyHash: PURCHASE_WALLET } as Parameters<typeof fetchUserHistory>[1],
    undefined,
    20,
    {} as Parameters<typeof fetchUserHistory>[4],
    undefined,
    undefined,
    decimals
  );
  const byHash = await fetchUserOperationByHash(
    TempleChainId.Basenet,
    PURCHASE_WALLET,
    purchaseFixture().hash,
    undefined,
    decimals
  );
  expect(result.items).toEqual(byHash);
  expect(result).toMatchObject({ cursor: 65453114261504, hasMore: true });
  expect(decimals).toHaveBeenCalledWith([`${PURCHASE_ASSET}_0`, `${PAYMENT_ASSET}_0`]);
  expect(result.items[0].displayMoneyDiffs).toEqual([
    { assetSlug: `${PAYMENT_ASSET}_0`, diff: '-6' },
    { assetSlug: `${PURCHASE_ASSET}_0`, diff: '0.2' }
  ]);
  expect(mavrykApi.get).toHaveBeenLastCalledWith(`/wallets/${PURCHASE_WALLET}/history`, {
    _authContext: expect.objectContaining({ walletAddress: PURCHASE_WALLET }),
    params: { cursor: undefined, search: purchaseFixture().hash, filter: undefined, limit: 20, token_id: undefined }
  });
});

it('preserves string display amounts through API validation and normalization', async () => {
  const parent = purchaseFixture();
  parent.details!.amount = '9007199254740993.123456';
  (mavrykApi.get as jest.Mock).mockResolvedValue({
    data: { walletAddress: PURCHASE_WALLET, operations: [parent], hasMore: false }
  });
  expect((await fetchWalletHistory({ walletAddress: PURCHASE_WALLET })).operations[0].details!.amount).toBe(
    '9007199254740993.123456'
  );
  const [item] = await fetchUserOperationByHash(
    TempleChainId.Basenet,
    PURCHASE_WALLET,
    parent.hash,
    undefined,
    async () => PURCHASE_DECIMALS
  );
  expect(item.displayMoneyDiffs![0].diff).toBe('-9007199254740993.123456');
});

it('uses the popup token address even without an asset slug, for pagination and hash lookup', async () => {
  (mavrykApi.get as jest.Mock).mockResolvedValue({
    data: { walletAddress: PURCHASE_WALLET, operations: [], hasMore: false }
  });
  await fetchUserHistory(
    TempleChainId.Basenet,
    { publicKeyHash: PURCHASE_WALLET } as Parameters<typeof fetchUserHistory>[1],
    undefined,
    20,
    {} as Parameters<typeof fetchUserHistory>[4],
    123,
    undefined,
    undefined,
    MVRK_HISTORY_TOKEN_ADDRESS
  );
  await fetchUserOperationByHash(
    TempleChainId.Basenet,
    PURCHASE_WALLET,
    'test-hash',
    undefined,
    undefined,
    MVRK_HISTORY_TOKEN_ADDRESS
  );
  expect(mavrykApi.get).toHaveBeenNthCalledWith(
    1,
    `/wallets/${PURCHASE_WALLET}/tokens/mv2ZZZZZZZZZZZZZZZZZZZZZZZZZZZDXMF2d/history`,
    {
      _authContext: expect.objectContaining({ walletAddress: PURCHASE_WALLET }),
      params: { cursor: 123, search: undefined, filter: undefined, limit: 20, token_id: undefined }
    }
  );
  expect(mavrykApi.get).toHaveBeenNthCalledWith(
    2,
    `/wallets/${PURCHASE_WALLET}/tokens/mv2ZZZZZZZZZZZZZZZZZZZZZZZZZZZDXMF2d/history`,
    {
      _authContext: expect.objectContaining({ walletAddress: PURCHASE_WALLET }),
      params: { cursor: undefined, search: 'test-hash', filter: undefined, limit: 20, token_id: undefined }
    }
  );
});

it('resolves metadata for raw-only interaction summaries through the existing history enrichment', async () => {
  const operation = refundFixture();
  delete operation.details!.amount;
  (mavrykApi.get as jest.Mock).mockResolvedValue({
    data: { walletAddress: REFUND_WALLET, operations: [operation], hasMore: false }
  });
  const resolveDecimals = jest.fn().mockResolvedValue({ [`${REFUND_TOKEN}_0`]: 6 });
  const items = await fetchUserOperationByHash(
    TempleChainId.Basenet,
    REFUND_WALLET,
    operation.hash,
    undefined,
    resolveDecimals
  );
  expect(resolveDecimals).toHaveBeenCalledWith([`${REFUND_TOKEN}_0`]);
  expect(items[0].displayMoneyDiffs).toEqual([{ assetSlug: `${REFUND_TOKEN}_0`, diff: '4.26', symbol: 'OCEAN' }]);
});

const fetchFirstWalletPage = () =>
  fetchUserHistory(
    TempleChainId.Basenet,
    { publicKeyHash: PURCHASE_WALLET } as Parameters<typeof fetchUserHistory>[1],
    undefined,
    1,
    {} as Parameters<typeof fetchUserHistory>[4],
    456
  );

it('keeps the whole page beyond the requested limit and returns the enrichment status', async () => {
  const transfer = (hash: string) => ({
    hash,
    type: 'transfer',
    status: 'applied',
    details: { type: 'transfer', transferType: 'received', to: PURCHASE_WALLET, amount: 1, currency: 'MVRK' }
  });
  (mavrykApi.get as jest.Mock).mockResolvedValue({
    data: {
      walletAddress: PURCHASE_WALLET,
      operations: [transfer('a'), transfer('b'), transfer('c')],
      cursor: 7,
      hasMore: true,
      equiteezHistory: { status: 'stale' }
    }
  });

  await expect(fetchFirstWalletPage()).resolves.toMatchObject({ cursor: 7, hasMore: true, equiteezStatus: 'stale' });
  expect((await fetchFirstWalletPage()).items).toHaveLength(3);
});

it('surfaces request failures and a non-advancing cursor instead of an empty terminal page', async () => {
  (mavrykApi.get as jest.Mock).mockRejectedValueOnce(new Error('network down'));
  await expect(fetchFirstWalletPage()).rejects.toThrow();

  (mavrykApi.get as jest.Mock).mockResolvedValueOnce({
    data: { walletAddress: PURCHASE_WALLET, operations: [], cursor: 456, hasMore: true }
  });
  await expect(fetchFirstWalletPage()).rejects.toThrow('no advancing cursor');

  (mavrykApi.get as jest.Mock).mockRejectedValueOnce(new Error('network down'));
  await expect(fetchUserOperationByHash(TempleChainId.Basenet, PURCHASE_WALLET, 'hash')).rejects.toThrow();
});

describe('Watch only history', () => {
  const watchOnlyAccount = {
    publicKeyHash: PURCHASE_WALLET,
    type: TempleAccountType.WatchOnly
  } as Parameters<typeof fetchUserHistory>[1];

  it('reads general history from the public route on the captured network without pending merge', async () => {
    (mavrykApi.get as jest.Mock).mockResolvedValue({
      data: { walletAddress: PURCHASE_WALLET, operations: [], cursor: 123, hasMore: true }
    });

    const result = await fetchUserHistory(
      TempleChainId.Basenet,
      watchOnlyAccount,
      undefined,
      20,
      {} as Parameters<typeof fetchUserHistory>[4],
      456,
      { sender: PURCHASE_WALLET },
      undefined,
      undefined,
      'basenet'
    );

    expect(mavrykApi.get).toHaveBeenLastCalledWith(`/watch-only/wallets/${PURCHASE_WALLET}/history`, {
      publicRead: { networkId: 'basenet' },
      params: { cursor: 456, search: undefined, filter: 'sent', limit: 20, token_id: undefined }
    });
    expect(result).toEqual({ items: [], cursor: 123, hasMore: true });
    expect(fetchFromStorage).not.toHaveBeenCalled();
  });

  it('never requests per-asset history for a Watch only account', async () => {
    await expect(
      fetchUserHistory(
        TempleChainId.Basenet,
        watchOnlyAccount,
        MAV_TOKEN_SLUG,
        20,
        {} as Parameters<typeof fetchUserHistory>[4]
      )
    ).rejects.toMatchObject({ code: WATCH_ONLY_ASSET_HISTORY_UNSUPPORTED });
    await expect(
      fetchUserOperationByHash(
        TempleChainId.Basenet,
        PURCHASE_WALLET,
        'hash',
        MAV_TOKEN_SLUG,
        undefined,
        undefined,
        'basenet'
      )
    ).rejects.toMatchObject({ code: WATCH_ONLY_ASSET_HISTORY_UNSUPPORTED });
    expect(mavrykApi.get).not.toHaveBeenCalled();
  });

  it('searches a hash through public general history', async () => {
    await fetchUserOperationByHash(
      TempleChainId.Basenet,
      PURCHASE_WALLET,
      'operation-hash',
      undefined,
      undefined,
      undefined,
      'mainnet'
    );

    expect(mavrykApi.get).toHaveBeenLastCalledWith(`/watch-only/wallets/${PURCHASE_WALLET}/history`, {
      publicRead: { networkId: 'mainnet' },
      params: { cursor: undefined, search: 'operation-hash', filter: undefined, limit: 20, token_id: undefined }
    });
  });

  it('keeps status and Retry-After on failures instead of a bare message', async () => {
    (mavrykApi.get as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, headers: { 'retry-after': '42' }, data: { error: 'Slow down', code: 'rate_limited' } }
    });

    await expect(
      fetchUserHistory(
        TempleChainId.Basenet,
        watchOnlyAccount,
        undefined,
        20,
        {} as Parameters<typeof fetchUserHistory>[4],
        undefined,
        undefined,
        undefined,
        undefined,
        'basenet'
      )
    ).rejects.toMatchObject({ status: 429, code: 'rate_limited', retryAfterSeconds: 42 });
  });

  it('accepts only complete operation hashes for search', () => {
    expect(isFullOperationHash('oo7Ad')).toBe(false);
    expect(isFullOperationHash(`oo${'1'.repeat(49)}`)).toBe(true);
    expect(isFullOperationHash(`oo${'0'.repeat(49)}`)).toBe(false);
  });
});

describe('normalizeRecentOperationsItems', () => {
  it('keeps every returned group as its own card in server order, even when hashes repeat', async () => {
    const first = purchaseFixture();
    const second = purchaseFixture();
    const third = refundFixture();

    const items = await normalizeRecentOperationsItems([first, second, third], PURCHASE_WALLET);

    expect(items).toHaveLength(3);
    expect(items.map(item => item.hash)).toEqual([first.hash, second.hash, third.hash]);
    expect(new Set(items.map(item => item.id)).size).toBe(3);
    expect(items[0].id.startsWith('0:')).toBe(true);
  });
});
