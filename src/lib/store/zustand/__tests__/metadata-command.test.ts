import { awaitStoresHydrated } from '../await-stores-hydrated';
import { applyMetadataRecords, reserveMetadataRevision } from '../metadata-command';
import { createMetadataStore } from '../metadata.store';
import { memoryStorage } from '../test-support/helpers';

const record = {
  address: 'KT1test',
  id: '0',
  decimals: 6,
  name: 'Saved',
  symbol: 'S',
  displayUri: 'old',
  artifactUri: 'old'
};

it('isolates same-slug sources, protects newer writes, retains legacy fallback and survives restart', async () => {
  const { storage } = memoryStorage();
  const store = createMetadataStore(storage);
  await awaitStoresHydrated(store);
  store.getState().putTokenMetadataDirectly('KT1test_0', record);
  let old = 0;
  store.persistence
    .prepare(draft => {
      old = reserveMetadataRevision(draft);
    })
    .commit();
  store.persistence
    .prepare(draft => {
      applyMetadataRecords(draft, 'tokens', { KT1test_0: { ...record, name: 'A' } }, 'put', 'scope-a');
      applyMetadataRecords(draft, 'tokens', { KT1test_0: { ...record, name: 'B' } }, 'put', 'scope-b');
      applyMetadataRecords(draft, 'tokens', { KT1test_0: { ...record, name: 'Obsolete' } }, 'put', 'scope-a', old);
      applyMetadataRecords(draft, 'tokens', { KT1test_0: { ...record, name: 'Seed' } }, 'whitelist', 'scope-a');
      applyMetadataRecords(draft, 'tokens', {}, 'put', 'scope-a');
    })
    .commit();
  await store.persistence.flush();
  const reloaded = createMetadataStore(storage);
  await awaitStoresHydrated(reloaded);
  expect(reloaded.getState().tokensMetadata.KT1test_0.name).toBe('Saved');
  expect(reloaded.getState().scoped?.['scope-a'].tokensMetadata.KT1test_0.name).toBe('A');
  expect(reloaded.getState().scoped?.['scope-b'].tokensMetadata.KT1test_0.name).toBe('B');
  reloaded.persistence
    .prepare(draft =>
      applyMetadataRecords(
        draft,
        'tokens',
        {
          KT1test_0: { ...record, name: 'Ignored', displayUri: 'new', artifactUri: 'new' }
        },
        'refresh',
        'scope-a'
      )
    )
    .commit();
  expect(reloaded.getState().scoped?.['scope-a'].tokensMetadata.KT1test_0).toMatchObject({
    name: 'A',
    displayUri: 'new'
  });
  await reloaded.persistence.flush();
  expect((await reloaded.persistence.readBack())?.state.scoped).toEqual(reloaded.getState().scoped);
});

it('retains failed scoped writes for verified retry without changing old envelopes', async () => {
  const { storage } = memoryStorage();
  const store = createMetadataStore(storage);
  await awaitStoresHydrated(store);
  store.persistence
    .prepare(draft => applyMetadataRecords(draft, 'collectibles', { KT1test_0: record }, 'put', 'scope'))
    .commit();
  (storage.set as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(store.persistence.flush()).rejects.toThrow();
  await store.persistence.flush();
  const reloaded = createMetadataStore(storage);
  await awaitStoresHydrated(reloaded);
  expect(reloaded.getState().scoped?.scope.collectiblesMetadata.KT1test_0).toEqual(record);
});

it('keeps known whitelist seeds scoped and non-overwriting, and never creates records through media refresh', async () => {
  const { storage } = memoryStorage();
  const store = createMetadataStore(storage);
  await awaitStoresHydrated(store);
  store.persistence
    .prepare(draft => {
      applyMetadataRecords(draft, 'tokens', { KT1test_0: record }, 'whitelist', 'whitelist-madfish-mainnet');
      applyMetadataRecords(
        draft,
        'tokens',
        { KT1test_0: { ...record, name: 'Ignored' } },
        'whitelist',
        'whitelist-madfish-mainnet'
      );
      applyMetadataRecords(draft, 'tokens', { KT1missing_0: record }, 'refresh', 'scope');
    })
    .commit();
  expect(store.getState().tokensMetadata.KT1test_0).toBeUndefined();
  expect(store.getState().scoped?.['whitelist-madfish-mainnet'].tokensMetadata.KT1test_0.name).toBe('Saved');
  expect(store.getState().scoped?.scope.tokensMetadata.KT1missing_0).toBeUndefined();
  await store.persistence.flush();
});
