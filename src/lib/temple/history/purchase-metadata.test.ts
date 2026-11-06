import { CancelledError, QueryClient } from '@tanstack/react-query';

import { requestMetadata } from 'lib/metadata/metadata-query';
import { getMetadataScopeKey } from 'lib/metadata/metadata-scope';
import { getOwnedUISnapshot } from 'lib/store/zustand/ui-client';

import { resolvePurchaseDecimals } from './purchase-metadata';

jest.mock('lib/metadata/metadata-query', () => ({ requestMetadata: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({ getOwnedUISnapshot: jest.fn() }));

const scope = { account: 'buyer', chainId: 'chain', networkId: 'basenet', rpcUrl: 'https://rpc.test' };
const key = getMetadataScopeKey(scope);
const client = new QueryClient();
const scoped = { rwasMetadata: {}, tokensMetadata: {}, collectiblesMetadata: {} };
beforeEach(() => jest.clearAllMocks());
afterAll(() => client.clear());

it('uses exact scoped metadata, never same-slug records from a different scope or legacy fallback', async () => {
  (getOwnedUISnapshot as jest.Mock).mockReturnValue({
    metadata: {
      rwasMetadata: { asset: { decimals: 1 } },
      scoped: {
        [key]: { ...scoped, rwasMetadata: { asset: { decimals: 18 } } },
        other: { ...scoped, rwasMetadata: { asset: { decimals: 2 } } }
      }
    }
  });
  expect(await resolvePurchaseDecimals(client, scope, ['asset'])).toEqual({ asset: 18 });
  expect(requestMetadata).not.toHaveBeenCalled();
});

it('waits for scoped owner publication and falls back to on-chain metadata for catalog misses', async () => {
  const record: Record<string, { decimals: number }> = {};
  (getOwnedUISnapshot as jest.Mock).mockReturnValue({
    metadata: { scoped: { [key]: { ...scoped, collectiblesMetadata: record } } }
  });
  (requestMetadata as jest.Mock).mockImplementation(async (_client, captured, category) => {
    expect(captured).toEqual(scope);
    if (category === 'collectibles') record.asset = { decimals: 9 };
  });
  expect(await resolvePurchaseDecimals(client, scope, ['asset'])).toEqual({ asset: 9 });
  expect(requestMetadata).toHaveBeenNthCalledWith(1, client, scope, 'rwas', ['asset']);
  expect(requestMetadata).toHaveBeenNthCalledWith(2, client, scope, 'collectibles', ['asset']);
});

it('keeps failures unavailable and propagates scope cancellation', async () => {
  (getOwnedUISnapshot as jest.Mock).mockReturnValue({ metadata: { scoped: {} } });
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (requestMetadata as jest.Mock).mockRejectedValue(new Error('unavailable'));
  expect(await resolvePurchaseDecimals(client, scope, ['asset'])).toEqual({});
  expect(log).toHaveBeenCalled();
  (requestMetadata as jest.Mock).mockRejectedValue(new CancelledError());
  await expect(resolvePurchaseDecimals(client, scope, ['asset'])).rejects.toBeInstanceOf(CancelledError);
  log.mockRestore();
});
