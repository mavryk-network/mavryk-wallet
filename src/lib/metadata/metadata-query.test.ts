import { QueryClient } from '@tanstack/react-query';

import { metadataKeys } from 'lib/query-keys';
import { deferred } from 'lib/store/zustand/test-support/helpers';
import { getOwnedUISnapshot, requestOwnedUISnapshot, updateOwnedUI } from 'lib/store/zustand/ui-client';
import { fetchWalletTokens, mapWalletTokensToFetchedMetadataRecord } from 'mavryk/api';
import { fetchWalletRwaAssets } from 'mavryk/api/rwas';
import { getSelectedNetworkIdFromStorage, getWalletAddressFromStorage } from 'mavryk/api/storage';

import { fetchOneTokenMetadata, loadTokensMetadataStrict } from './fetch';
import { requestMetadata } from './metadata-query';
import { previewMetadata } from './preview-metadata';
import { refreshMetadata } from './refresh-metadata';
import { normalizeMetadata, saveMetadata } from './sync-metadata';

jest.mock('./fetch', () => ({ loadTokensMetadataStrict: jest.fn(), fetchOneTokenMetadata: jest.fn() }));
jest.mock('mavryk/api', () => ({ fetchWalletTokens: jest.fn(), mapWalletTokensToFetchedMetadataRecord: jest.fn() }));
jest.mock('mavryk/api/client', () => ({ mavrykApi: { get: jest.fn() } }));
jest.mock('mavryk/api/rwas', () => ({
  ...jest.requireActual('mavryk/api/rwas'),
  fetchWalletRwaAssets: jest.fn()
}));
jest.mock('lib/store/zustand/ui-client', () => ({
  updateOwnedUI: jest.fn(),
  requestOwnedUISnapshot: jest.fn(),
  getOwnedUISnapshot: jest.fn()
}));
jest.mock('mavryk/api/storage', () => ({
  getSelectedNetworkIdFromStorage: jest.fn(),
  getWalletAddressFromStorage: jest.fn(),
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY: 'auth-map'
}));
const scope = { account: 'alice', chainId: 'custom', networkId: 'custom', rpcUrl: 'https://custom.test' };
const raw = { name: 'Test', symbol: 'T', decimals: 6 };
let client: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  (getWalletAddressFromStorage as jest.Mock).mockResolvedValue(scope.account);
  (getSelectedNetworkIdFromStorage as jest.Mock).mockResolvedValue(scope.networkId);
  (updateOwnedUI as jest.Mock).mockResolvedValue(undefined);
  (requestOwnedUISnapshot as jest.Mock).mockImplementation(async command => ({
    metadata: { lastReceipt: command.requestId }
  }));
  (loadTokensMetadataStrict as jest.Mock).mockImplementation(async (_rpc, slugs: string[]) =>
    Object.fromEntries(slugs.map(slug => [slug, raw]))
  );
});
afterEach(() => client.clear());

it('coalesces overlap, chunks, queues additions during a batch and awaits acknowledgement', async () => {
  const publication = deferred<unknown>();
  (requestOwnedUISnapshot as jest.Mock).mockImplementationOnce(async command => {
    await publication.promise;
    return { metadata: { lastReceipt: command.requestId } };
  });
  const slugs = Array.from({ length: 80 }, (_, i) => `KT1test_${i}`);
  let settled = false;
  const first = requestMetadata(client, scope, 'collectibles', slugs.slice(0, 60)).then(() => {
    settled = true;
  });
  const second = requestMetadata(client, scope, 'collectibles', slugs.slice(30));
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(loadTokensMetadataStrict).toHaveBeenCalledTimes(2);
  expect(settled).toBe(false);
  const third = requestMetadata(client, scope, 'collectibles', ['KT1extra_0']);
  publication.resolve(undefined);
  await Promise.all([first, second, third]);
  expect(loadTokensMetadataStrict).toHaveBeenCalledTimes(3);
  expect(client.getQueryData(metadataKeys.receipt('collectibles', scope, 'put', slugs[0]))).toBe('found');
  await requestMetadata(client, scope, 'collectibles', slugs);
  expect(loadTokensMetadataStrict).toHaveBeenCalledTimes(3);
});

it('distinguishes misses, partial responses, transport and publication failures, with retry/invalidation', async () => {
  (loadTokensMetadataStrict as jest.Mock).mockResolvedValueOnce({ KT1test_0: null });
  await requestMetadata(client, scope, 'collectibles', ['KT1test_0']);
  const key = metadataKeys.receipt('collectibles', scope, 'put', 'KT1test_0');
  expect(client.getQueryData(key)).toBe('missing');
  await requestMetadata(client, scope, 'collectibles', ['KT1test_0']);
  expect(loadTokensMetadataStrict).toHaveBeenCalledTimes(1);
  await client.invalidateQueries(key);
  (loadTokensMetadataStrict as jest.Mock).mockResolvedValueOnce({});
  await expect(requestMetadata(client, scope, 'collectibles', ['KT1test_0'])).rejects.toThrow('Incomplete');
  (loadTokensMetadataStrict as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(requestMetadata(client, scope, 'collectibles', ['KT1test_0'])).rejects.toThrow('offline');
  (requestOwnedUISnapshot as jest.Mock).mockRejectedValueOnce(new Error('write'));
  await expect(requestMetadata(client, scope, 'collectibles', ['KT1test_0'])).rejects.toThrow('write');
  await requestMetadata(client, scope, 'collectibles', ['KT1test_0']);
  expect(client.getQueryData(key)).toBe('found');
});

it('discards removed consumers and switched accounts without publication', async () => {
  const transport = deferred<Record<string, typeof raw>>();
  (loadTokensMetadataStrict as jest.Mock).mockReturnValueOnce(transport.promise);
  const controller = new AbortController();
  const result = requestMetadata(client, scope, 'collectibles', ['KT1test_0'], 'put', controller.signal);
  await new Promise(resolve => setTimeout(resolve, 10));
  controller.abort();
  transport.resolve({ KT1test_0: raw });
  await expect(result).rejects.toBeDefined();
  expect(requestOwnedUISnapshot).not.toHaveBeenCalled();
  (getWalletAddressFromStorage as jest.Mock).mockResolvedValue('bob');
  await expect(requestMetadata(client, scope, 'collectibles', ['KT1test_0'])).rejects.toBeDefined();
  expect(requestOwnedUISnapshot).not.toHaveBeenCalled();
});

it('keeps all source inputs distinct and uses wallet mapping for tokens only', async () => {
  (fetchWalletTokens as jest.Mock).mockResolvedValue([]);
  (mapWalletTokensToFetchedMetadataRecord as jest.Mock).mockReturnValue({ KT1test_0: raw });
  await requestMetadata(client, scope, 'tokens', ['KT1test_0']);
  expect(fetchWalletTokens).toHaveBeenCalledWith({ walletAddress: 'alice' });
  expect(loadTokensMetadataStrict).not.toHaveBeenCalled();
  for (const field of ['account', 'chainId', 'networkId', 'rpcUrl'] as const)
    expect(metadataKeys.scope('tokens', { ...scope, [field]: 'other' })).not.toEqual(
      metadataKeys.scope('tokens', scope)
    );
  expect(normalizeMetadata('tokens', ['KT1test_0'], { KT1test_0: { decimals: 0 } }).KT1test_0).toMatchObject({
    name: 'Unknown Token',
    symbol: '???'
  });
  expect(() => normalizeMetadata('tokens', ['KT1test_0'], { KT1test_0: { decimals: NaN } })).toThrow();
  expect(normalizeMetadata('rwas', ['KT1test_0'], { KT1test_0: raw }).KT1test_0.symbol).toBe('T');
  expect(normalizeMetadata('rwas', ['KT1test_0'], { KT1test_0: { ...raw, symbol: 'OCEAN' } }).KT1test_0.symbol).toBe(
    'OCEAN'
  );
  expect(
    normalizeMetadata('collectibles', ['KT1test_0'], { KT1test_0: { ...raw, artifactUri: '' } }).KT1test_0.artifactUri
  ).toBe('');
});

it('loads RWA page metadata from the catalog without symbol filtering or the legacy metadata transport', async () => {
  (fetchWalletRwaAssets as jest.Mock).mockResolvedValue([
    { address: 'KT1new', balance: 1, symbol: 'ANTH', metadata: { decimals: '6', icon: 'https://asset.test/icon' } }
  ]);
  await requestMetadata(client, scope, 'rwas', ['KT1new_0', 'KT1missing_0']);
  expect(loadTokensMetadataStrict).not.toHaveBeenCalled();
  expect(requestOwnedUISnapshot).toHaveBeenCalledWith(
    expect.objectContaining({
      category: 'rwas',
      records: {
        KT1new_0: expect.objectContaining({ symbol: 'ANTH', decimals: 6, thumbnailUri: 'https://asset.test/icon' })
      }
    })
  );
  expect(client.getQueryData(metadataKeys.receipt('rwas', scope, 'put', 'KT1new_0'))).toBe('found');
  expect(client.getQueryData(metadataKeys.receipt('rwas', scope, 'put', 'KT1missing_0'))).toBe('missing');
});

it('records scoped refresh completion after acknowledgement, preserves history and retries incomplete refreshes', async () => {
  const completion = deferred<unknown>();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: async (_name: string, run: () => Promise<unknown>) => run() }
  });
  localStorage.setItem('METADATA_REFRESH', JSON.stringify({ legacy: 1 }));
  (getOwnedUISnapshot as jest.Mock).mockReturnValue({ metadata: { tokensMetadata: { KT1test_0: raw } } });
  (fetchWalletTokens as jest.Mock).mockResolvedValue([]);
  (mapWalletTokensToFetchedMetadataRecord as jest.Mock).mockReturnValue({ KT1test_0: raw });
  (requestOwnedUISnapshot as jest.Mock).mockImplementationOnce(async command => {
    await completion.promise;
    return { metadata: { lastReceipt: command.requestId } };
  });
  const run = refreshMetadata(client, scope);
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(JSON.parse(localStorage.getItem('METADATA_REFRESH')!)).toEqual({ legacy: 1 });
  completion.resolve(undefined);
  await run;
  const records = JSON.parse(localStorage.getItem('METADATA_REFRESH')!);
  expect(records.legacy).toBe(1);
  expect(Object.keys(records)).toHaveLength(2);
  await refreshMetadata(client, scope);
  expect(fetchWalletTokens).toHaveBeenCalledTimes(1);
  localStorage.setItem('METADATA_REFRESH', JSON.stringify({ legacy: 1 }));
  await client.invalidateQueries(metadataKeys.scope('tokens', scope));
  (mapWalletTokensToFetchedMetadataRecord as jest.Mock).mockReturnValueOnce({ KT1test_0: null });
  await expect(refreshMetadata(client, scope)).rejects.toThrow('incomplete');
  expect(JSON.parse(localStorage.getItem('METADATA_REFRESH')!)).toEqual({ legacy: 1 });
  await client.invalidateQueries(metadataKeys.scope('tokens', scope));
  await refreshMetadata(client, scope);
  expect(Object.keys(JSON.parse(localStorage.getItem('METADATA_REFRESH')!))).toHaveLength(2);
});

it('deduplicates provisional previews without saving or enabling assets, then awaits explicit metadata save', async () => {
  (fetchOneTokenMetadata as jest.Mock).mockResolvedValue(raw);
  const [first, second] = await Promise.all([
    previewMetadata(client, scope, 'KT1test', '0'),
    previewMetadata(client, scope, 'KT1test', '0')
  ]);
  expect(first).toEqual(raw);
  expect(second).toEqual(raw);
  expect(fetchOneTokenMetadata).toHaveBeenCalledTimes(1);
  expect(updateOwnedUI).not.toHaveBeenCalled();
  expect(requestOwnedUISnapshot).not.toHaveBeenCalled();
  const acknowledgement = deferred<void>();
  (updateOwnedUI as jest.Mock).mockReturnValueOnce(acknowledgement.promise);
  let isSaved = false;
  const save = saveMetadata(scope, 'tokens', { KT1test_0: { ...raw, address: 'KT1test', id: '0' } }).then(() => {
    isSaved = true;
  });
  await Promise.resolve();
  expect(isSaved).toBe(false);
  expect(updateOwnedUI).toHaveBeenCalledWith(expect.objectContaining({ kind: 'metadata-save', category: 'tokens' }));
  acknowledgement.resolve(undefined);
  await save;
  expect(isSaved).toBe(true);
});

it('serializes concurrent foreground refresh completion and preserves entries added during transport', async () => {
  let queue: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (_name: string, run: () => Promise<unknown>) => {
        const result = queue.then(run);
        queue = result.catch(() => undefined);
        return result;
      }
    }
  });
  localStorage.setItem('METADATA_REFRESH', JSON.stringify({ legacy: 1 }));
  (getOwnedUISnapshot as jest.Mock).mockReturnValue({ metadata: { tokensMetadata: { KT1test_0: raw } } });
  (mapWalletTokensToFetchedMetadataRecord as jest.Mock).mockReturnValue({ KT1test_0: raw });
  const transport = deferred<unknown[]>();
  (fetchWalletTokens as jest.Mock).mockReturnValue(transport.promise);
  const other = new QueryClient();
  const first = refreshMetadata(client, scope);
  const second = refreshMetadata(other, scope);
  await new Promise(resolve => setTimeout(resolve, 10));
  localStorage.setItem('METADATA_REFRESH', JSON.stringify({ legacy: 1, unrelated: 7 }));
  transport.resolve([]);
  await Promise.all([first, second]);
  expect(fetchWalletTokens).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem('METADATA_REFRESH')!)).toMatchObject({ legacy: 1, unrelated: 7 });
  other.clear();
});
