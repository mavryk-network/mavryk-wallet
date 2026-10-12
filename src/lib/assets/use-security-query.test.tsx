import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { fetchScamlistTokens } from 'lib/apis/temple/scamlist-tokens';
import { fetchWhitelistTokens } from 'lib/apis/temple/whitelist-tokens';
import { assetsKeys } from 'lib/query-keys';
import { deferred } from 'lib/store/zustand/test-support/helpers';
import { useOwnedUIStatus } from 'lib/store/zustand/ui-client';
import { TempleChainId } from 'lib/temple/types';

import { beginAssetSync, syncSecurity } from './sync-security';
import { useSecurityQuery } from './use-security-query';

jest.mock('lib/apis/temple/scamlist-tokens', () => ({ fetchScamlistTokens: jest.fn() }));
jest.mock('lib/apis/temple/whitelist-tokens', () => ({ fetchWhitelistTokens: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({ useOwnedUIStatus: jest.fn() }));
jest.mock('./sync-security', () => ({ beginAssetSync: jest.fn(), syncSecurity: jest.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('deduplicates ready consumers, respects whitelist mainnet gate and waits for durable publication', async () => {
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: false });
  (beginAssetSync as jest.Mock).mockResolvedValue({ requestKey: 'scamlist', requestId: 'one' });
  (fetchScamlistTokens as jest.Mock).mockResolvedValue({ scam: true });
  (fetchWhitelistTokens as jest.Mock).mockResolvedValue([]);
  const receipt = deferred<void>();
  (syncSecurity as jest.Mock).mockReturnValue(receipt.promise);
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  const root = createRoot(document.createElement('div'));
  function Consumer({ chain }: { chain: string }) {
    useSecurityQuery(chain);
    return null;
  }
  const render = async (chain: string) =>
    act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Consumer chain={chain} />
          <Consumer chain={chain} />
        </QueryClientProvider>
      );
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  await render('test');
  expect(fetchScamlistTokens).not.toHaveBeenCalled();
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: true });
  await render('test');
  expect(fetchScamlistTokens).toHaveBeenCalledTimes(1);
  expect(fetchWhitelistTokens).not.toHaveBeenCalled();
  expect(client.getQueryState(assetsKeys.security('scamlist'))?.fetchStatus).toBe('fetching');
  expect(client.getQueryData(assetsKeys.security('scamlist'))).toBeUndefined();
  await act(async () => {
    receipt.resolve();
    await receipt.promise;
  });
  expect(client.getQueryData(assetsKeys.security('scamlist'))).toBe(true);
  await render(TempleChainId.Mainnet);
  expect(fetchWhitelistTokens).toHaveBeenCalledTimes(1);
  await render('test');
  await render(TempleChainId.Mainnet);
  expect(fetchWhitelistTokens).toHaveBeenCalledTimes(2);
  (fetchScamlistTokens as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    await client.invalidateQueries(assetsKeys.security('scamlist'));
  });
  expect(client.getQueryState(assetsKeys.security('scamlist'))?.status).toBe('error');
  expect(client.getQueryData(assetsKeys.security('scamlist'))).toBe(true);
  (syncSecurity as jest.Mock).mockRejectedValueOnce(new Error('owner write failed'));
  await act(async () => {
    await client.invalidateQueries(assetsKeys.security('scamlist'));
  });
  expect(client.getQueryState(assetsKeys.security('scamlist'))?.status).toBe('error');
  await act(async () => root.unmount());
  client.clear();
});
