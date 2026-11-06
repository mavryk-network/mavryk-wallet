import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ALL_PREDEFINED_METADATAS_RECORD } from 'lib/assets/known-tokens';
import { awaitStoresHydrated } from 'lib/store/zustand/await-stores-hydrated';
import { applyMetadataRecords } from 'lib/store/zustand/metadata-command';
import { createMetadataStore } from 'lib/store/zustand/metadata.store';
import { memoryStorage } from 'lib/store/zustand/test-support/helpers';
import { useOwnedUI } from 'lib/store/zustand/ui-client';
import { TempleChainId } from 'lib/temple/types';

import { getMetadataScopeKey, WHITELIST_METADATA_SCOPE_KEY } from './metadata-scope';
import { useMetadataScope } from './use-metadata-scope';
import { useOwnedMetadata } from './use-owned-metadata';

jest.mock('lib/store/zustand/ui-client', () => ({ useOwnedUI: jest.fn() }));
jest.mock('./use-metadata-scope', () => ({ useMetadataScope: jest.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('reads cold persisted scoped metadata independently of Query, preserving defaults and unknown legacy fallback', async () => {
  const { storage } = memoryStorage();
  const store = createMetadataStore(storage);
  await awaitStoresHydrated(store);
  const base = { address: 'KT1test', id: '0', decimals: 0, name: 'Legacy', symbol: 'L' };
  const a = { account: 'alice', chainId: 'custom', networkId: 'custom', rpcUrl: 'rpc-a' };
  const b = { ...a, rpcUrl: 'rpc-b' };
  store.getState().putTokenMetadataDirectly('KT1legacy_0', base);
  store.persistence
    .prepare(draft => {
      applyMetadataRecords(draft, 'tokens', { KT1test_0: { ...base, name: 'A' } }, 'put', getMetadataScopeKey(a));
      applyMetadataRecords(draft, 'tokens', { KT1test_0: { ...base, name: 'B' } }, 'put', getMetadataScopeKey(b));
      applyMetadataRecords(draft, 'tokens', { KT1seed_0: base }, 'whitelist', WHITELIST_METADATA_SCOPE_KEY);
    })
    .commit();
  await store.persistence.flush();
  const cold = createMetadataStore(storage);
  await awaitStoresHydrated(cold);
  (useOwnedUI as jest.Mock).mockImplementation(select => select({ metadata: cold.getState() }));
  (useMetadataScope as jest.Mock).mockReturnValue(a);
  const client = new QueryClient();
  client.setQueryData(['metadata'], { KT1test_0: { ...base, name: 'Wrong Query value' } });
  const root = createRoot(document.createElement('div'));
  let records: ReturnType<typeof useOwnedMetadata> = {};
  function Consumer() {
    records = useOwnedMetadata('tokens');
    return null;
  }
  const render = () =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <Consumer />
        </QueryClientProvider>
      )
    );
  await render();
  expect(records.KT1test_0.name).toBe('A');
  expect(records.KT1legacy_0.name).toBe('Legacy');
  expect(records.KT1seed_0).toBeUndefined();
  expect(records[Object.keys(ALL_PREDEFINED_METADATAS_RECORD)[0]]).toBeDefined();
  (useMetadataScope as jest.Mock).mockReturnValue(b);
  await render();
  expect(records.KT1test_0.name).toBe('B');
  (useMetadataScope as jest.Mock).mockReturnValue(a);
  await render();
  expect(records.KT1test_0.name).toBe('A');
  (useMetadataScope as jest.Mock).mockReturnValue({ ...a, chainId: TempleChainId.Mainnet });
  await render();
  expect(records.KT1seed_0.name).toBe('Legacy');
  expect(records.KT1test_0).toBeUndefined();
  await act(async () => root.unmount());
  client.clear();
});
