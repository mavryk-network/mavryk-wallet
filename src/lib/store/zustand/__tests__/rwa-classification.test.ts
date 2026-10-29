import { TempleChainId } from 'lib/temple/types';

import { applyAssetsCommand } from '../assets-command';
import { createAssetsStore } from '../assets.store';
import { awaitStoresHydrated } from '../await-stores-hydrated';
import { createMetadataStore } from '../metadata.store';
import { memoryStorage } from '../test-support/helpers';
import { createUIStore } from '../ui.store';

const chainId = TempleChainId.Basenet;
const key = `alice@${chainId}`;
const exception = 'KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v_0';

it.each(['tokens-first', 'rwas-first'])(
  'repairs persisted categories and retains choices with %s publication',
  async order => {
    const { storage } = memoryStorage();
    const stores = {
      assets: createAssetsStore(storage),
      metadata: createMetadataStore(storage),
      ui: createUIStore(storage)
    };
    await awaitStoresHydrated(stores.assets, stores.metadata, stores.ui);
    const base = { account: 'alice', chainId };
    stores.assets.getState().putTokensAsIs([
      { ...base, slug: 'new-rwa_0', status: 'enabled', manual: true },
      { ...base, slug: 'hidden-rwa_0', status: 'disabled' },
      { ...base, slug: 'regular_0', status: 'enabled' },
      { ...base, account: 'bob', slug: 'new-rwa_0', status: 'enabled' },
      { ...base, chainId: TempleChainId.Mainnet, slug: 'new-rwa_0', status: 'enabled' }
    ]);
    stores.assets.getState().putRwasAsIs([{ ...base, slug: exception, status: 'disabled', manual: true }]);
    const publish = (category: 'tokens' | 'rwas') =>
      applyAssetsCommand(
        {
          kind: 'assets-loaded',
          category,
          value: {
            ...base,
            // Simulate an old token request finishing after the RWA request.
            slugs: category === 'tokens' ? ['regular_0', 'new-rwa_0', exception] : ['new-rwa_0', 'hidden-rwa_0']
          }
        },
        stores
      );
    if (order === 'tokens-first') {
      publish('tokens');
      publish('rwas');
    } else {
      publish('rwas');
      publish('tokens');
    }
    expect(stores.assets.getState().tokens[key]).toEqual({
      regular_0: { status: 'enabled' },
      [exception]: { status: 'disabled', manual: true }
    });
    expect(stores.assets.getState().rwas[key]).toEqual({
      'new-rwa_0': { status: 'enabled', manual: true },
      'hidden-rwa_0': { status: 'disabled' }
    });
    expect(stores.assets.getState().tokens[`bob@${chainId}`]['new-rwa_0']).toEqual({ status: 'enabled' });
    expect(stores.assets.getState().tokens[`alice@${TempleChainId.Mainnet}`]['new-rwa_0']).toEqual({
      status: 'enabled'
    });
    await stores.assets.persistence.flush();
    const restarted = createAssetsStore(storage);
    await awaitStoresHydrated(restarted);
    expect(restarted.getState().tokens).toEqual(stores.assets.getState().tokens);
    expect(restarted.getState().rwas).toEqual(stores.assets.getState().rwas);
  }
);

// 2.0.9 kept older RWAs under tokens (where users hid/removed them) and also wrote idle RWA records for the
// same slugs while listing `/assets`. Reclassification must keep the user's choice, not the idle default.
it('keeps 2.0.9 token choices over idle RWA defaults when reclassifying', async () => {
  const { storage } = memoryStorage();
  const stores = {
    assets: createAssetsStore(storage),
    metadata: createMetadataStore(storage),
    ui: createUIStore(storage)
  };
  await awaitStoresHydrated(stores.assets, stores.metadata, stores.ui);
  const base = { account: 'alice', chainId };
  stores.assets.getState().putTokensAsIs([
    { ...base, slug: 'hidden-rwa_0', status: 'disabled' },
    { ...base, slug: 'removed-rwa_0', status: 'removed' },
    { ...base, slug: 'chosen-rwa_0', status: 'enabled' },
    { ...base, slug: exception, status: 'idle' }
  ]);
  stores.assets.getState().putRwasAsIs([
    { ...base, slug: 'hidden-rwa_0', status: 'idle' },
    { ...base, slug: 'removed-rwa_0', status: 'idle' },
    // An explicit RWA-side choice still wins over the token record.
    { ...base, slug: 'chosen-rwa_0', status: 'disabled' },
    { ...base, slug: exception, status: 'disabled' }
  ]);
  applyAssetsCommand(
    {
      kind: 'assets-loaded',
      category: 'rwas',
      value: { ...base, slugs: ['hidden-rwa_0', 'removed-rwa_0', 'chosen-rwa_0', exception] }
    },
    stores
  );
  expect(stores.assets.getState().rwas[key]).toEqual({
    'hidden-rwa_0': { status: 'disabled' },
    'removed-rwa_0': { status: 'removed' },
    'chosen-rwa_0': { status: 'disabled' }
  });
  expect(stores.assets.getState().tokens[key]).toEqual({ [exception]: { status: 'disabled' } });
});
