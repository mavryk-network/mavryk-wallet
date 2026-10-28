import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { of } from 'rxjs';

import { fetchObjktCollectibles$ } from 'lib/apis/objkt';
import { collectibleDetailHooks } from 'lib/collectibles/use-collectibles-details.query';
import { rwaDetailHooks } from 'lib/rwas/use-rwas-details.query';
import { updateOwnedUI } from 'lib/store/zustand/ui-client';
import { fetchWalletRwaAssets } from 'mavryk/api/rwas';

jest.mock('lib/apis/objkt', () => ({ fetchObjktCollectibles$: jest.fn() }));
jest.mock('lib/temple/front', () => ({}));
jest.mock('lib/store/zustand/ui-client', () => ({ updateOwnedUI: jest.fn().mockResolvedValue(undefined) }));
jest.mock('mavryk/api/rwas', () => ({
  fetchWalletRwaAssets: jest.fn(),
  walletRwaAssetToDetails: (asset: { name: string }) => ({ name: asset.name })
}));
jest.mock('mavryk/api/storage', () => ({
  getSelectedNetworkIdFromStorage: jest.fn().mockResolvedValue('mainnet'),
  getWalletAddressFromStorage: jest.fn().mockResolvedValue('a'),
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY: 'auth-map'
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('uses one existing transport batch per category for multiple cards and commands the durable flag owner', async () => {
  const fetchCollectibles = fetchObjktCollectibles$ as jest.MockedFunction<typeof fetchObjktCollectibles$>;
  const fetchRwas = fetchWalletRwaAssets as jest.MockedFunction<typeof fetchWalletRwaAssets>;
  fetchCollectibles.mockReturnValue(
    of({
      tokens: [
        {
          __typename: 'token',
          fa_contract: 'nft',
          token_id: '0',
          listings_active: [{ currency_id: 0, price: 1 }],
          description: 'NFT',
          timestamp: '2026-01-01',
          metadata: null,
          mime: null,
          artifact_uri: '',
          creators: [],
          fa: { name: '', logo: '', editions: 1 },
          galleries: [],
          tags: [],
          attributes: [],
          supply: 1,
          royalties: []
        }
      ],
      galleriesAttributesCounts: []
    })
  );
  fetchRwas.mockResolvedValue([
    {
      address: 'rwa',
      name: 'RWA',
      balance: 1,
      marketPrice: null,
      lastSale: null,
      pricingValidUntil: null,
      marketValueUsd: null
    }
  ]);
  const scope = { account: 'a', chainId: 'c', networkId: 'mainnet' };
  function Cards() {
    collectibleDetailHooks.useBatch(scope, ['nft_0', 'missing_0']);
    rwaDetailHooks.useBatch(scope, ['rwa_0', 'absent_0']);
    const nft = collectibleDetailHooks.useDetail(scope, 'nft_0');
    const missing = collectibleDetailHooks.useDetail(scope, 'missing_0');
    const rwa = rwaDetailHooks.useDetail(scope, 'rwa_0');
    return (
      <div>
        {nft?.description}:{rwa?.name}:{missing === null ? 'missing' : 'pending'}
      </div>
    );
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Cards />
        </QueryClientProvider>
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    expect(container.textContent).toBe('NFT:RWA:missing');
    expect(fetchCollectibles).toHaveBeenCalledTimes(1);
    expect(fetchCollectibles).toHaveBeenCalledWith(['missing_0', 'nft_0']);
    expect(fetchRwas).toHaveBeenCalledTimes(1);
    expect(updateOwnedUI).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'adult-flags',
        category: 'collectibles',
        flags: { nft_0: { val: false, ts: expect.any(Number) } }
      })
    );
    expect(updateOwnedUI).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'adult-flags',
        category: 'rwas',
        flags: { rwa_0: { val: false, ts: expect.any(Number) } }
      })
    );
  } finally {
    act(() => root.unmount());
    await Promise.resolve();
    client.clear();
  }
});
