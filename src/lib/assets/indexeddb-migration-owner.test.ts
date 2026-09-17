import { fetchOneTokenMetadata, isKnownChainId } from 'lib/apis/temple/metadata';

import { migrateIndexedDBAssets } from './indexeddb-migration';
import { runIndexedDBAssetsMigration } from './indexeddb-migration-owner';

jest.mock('lib/apis/temple/metadata', () => ({ fetchOneTokenMetadata: jest.fn(), isKnownChainId: jest.fn() }));
jest.mock('./indexeddb-migration', () => ({ migrateIndexedDBAssets: jest.fn() }));

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

function getFetch() {
  // Production wiring is inspected without creating competing destination adapters.
  const stores = {} as Parameters<typeof runIndexedDBAssetsMigration>[0];
  runIndexedDBAssetsMigration(stores);
  return (migrateIndexedDBAssets as jest.Mock).mock.calls[0][0].fetchMetadata as Parameters<
    typeof migrateIndexedDBAssets
  >[0]['fetchMetadata'];
}
const row = { account: 'account', chainId: 'chain', tokenSlug: 'contract_0', status: 1, addedAt: 1 };

it('uses the exact source chain and builds returned metadata with existing helpers', async () => {
  (isKnownChainId as jest.MockedFunction<typeof isKnownChainId>).mockReturnValue(true);
  (fetchOneTokenMetadata as jest.Mock).mockResolvedValue({ name: 'Example', symbol: 'EX', decimals: 6 });
  expect(await getFetch()(row)).toEqual({ address: 'contract', id: '0', name: 'Example', symbol: 'EX', decimals: 6 });
  expect(fetchOneTokenMetadata).toHaveBeenCalledWith('chain', 'contract', '0');
});

it('does not fetch from another network when the source network is unavailable', async () => {
  (isKnownChainId as jest.MockedFunction<typeof isKnownChainId>).mockReturnValue(false);
  expect(await getFetch()(row)).toBeUndefined();
  expect(fetchOneTokenMetadata).not.toHaveBeenCalled();
});

it('bounds classification requests and handles a late rejection without an unhandled promise', async () => {
  jest.useFakeTimers();
  (isKnownChainId as jest.MockedFunction<typeof isKnownChainId>).mockReturnValue(true);
  let reject!: (error: Error) => void;
  (fetchOneTokenMetadata as jest.Mock).mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  const result = getFetch()(row);
  jest.advanceTimersByTime(10_000);
  expect(await result).toBeUndefined();
  reject(new Error('late failure'));
  await Promise.resolve();
  expect(jest.getTimerCount()).toBe(0);
});
