import { TempleChainId } from 'lib/temple/types';
import { mavrykApi } from 'mavryk/api/client';
import { fetchWalletHistory } from 'mavryk/api/history';

import fetchUserHistory, { fetchUserOperationByHash } from './fetch';
import { PAYMENT_ASSET, PURCHASE_ASSET, PURCHASE_DECIMALS, PURCHASE_WALLET, purchaseFixture } from './purchase.fixture';

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
    params: { cursor: undefined, search: purchaseFixture().hash, filter: undefined }
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
