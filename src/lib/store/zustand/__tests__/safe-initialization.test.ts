import fs from 'fs';
import path from 'path';

import { awaitStoresHydrated } from '../await-stores-hydrated';
import { memoryStorage } from '../test-support/helpers';

it('importing the boundary only reads destination keys and never writes identity/defaults or invokes legacy deletion', async () => {
  const { storage, records } = memoryStorage({
    analytics_user_id: 'existing-identity',
    'persist:temple-root': { settings: { userId: 'legacy-identity' } },
    'persist:root.assets': { tokens: { data: { existing: true } } }
  });
  const legacy = JSON.stringify(records);
  const remove = jest.fn();
  const clear = jest.fn();
  const localWrite = jest.spyOn(Storage.prototype, 'setItem');
  const localRemove = jest.spyOn(Storage.prototype, 'removeItem');
  const localClear = jest.spyOn(Storage.prototype, 'clear');
  jest.doMock('webextension-polyfill', () => ({
    __esModule: true,
    default: { storage: { local: { ...storage, remove, clear } } }
  }));
  // Any import of the existing IndexedDB repository is an accidental activation dependency.
  jest.doMock('lib/temple/repo', () => {
    throw new Error('Unexpected IndexedDB dependency');
  });
  let destinations!: typeof import('../index');
  jest.isolateModules(() => {
    destinations = require('../index');
  });
  await awaitStoresHydrated(destinations.uiStore, destinations.metadataStore, destinations.assetsStore);
  expect((storage.get as jest.Mock).mock.calls.map(call => call[0]).sort()).toEqual([
    'zustand-assets',
    'zustand-metadata',
    'zustand-ui'
  ]);
  expect(storage.set).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
  expect(localWrite).not.toHaveBeenCalled();
  expect(localRemove).not.toHaveBeenCalled();
  expect(localClear).not.toHaveBeenCalled();
  expect(JSON.stringify(records)).toBe(legacy);
  expect(destinations.uiStore.getState().userId).toBeNull();
  localWrite.mockRestore();
  localRemove.mockRestore();
  localClear.mockRestore();
  jest.dontMock('webextension-polyfill');
  jest.dontMock('lib/temple/repo');
});

it('activates only the scoped UI/root metadata consumers and keeps asset destinations inactive', () => {
  const src = path.resolve(__dirname, '../../../..');
  const destinationPath = path.resolve(__dirname, '..');
  const consumers: string[] = [];
  const inspect = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (file === destinationPath) continue;
      if (entry.isDirectory()) inspect(file);
      else if (
        /\.tsx?$/.test(file) &&
        !/\.(test|spec)\.tsx?$/.test(file) &&
        /(?:from\s*|require\s*\()\s*['"][^'"]*store\/zustand/.test(fs.readFileSync(file, 'utf8'))
      ) {
        consumers.push(path.relative(src, file));
      }
    }
  };
  inspect(src);
  expect(consumers.sort()).toEqual(
    [
      'app/store/index.ts',
      'app/store/ab-testing/selectors.ts',
      'app/store/advertising/selectors.ts',
      'app/store/assets/epics.ts',
      'app/store/newsletter/newsletter-selectors.ts',
      'app/store/owned-ui.middleware.ts',
      'app/store/provider.tsx',
      'app/store/settings/selectors.ts',
      'app/store/tokens-metadata/selectors.ts',
      'lib/analytics/send-events.utils.ts',
      'lib/notifications/store/selectors.ts',
      'lib/temple/back/analytics.ts',
      'lib/temple/back/main.ts'
    ].sort()
  );
  for (const consumer of consumers) {
    expect(fs.readFileSync(path.join(src, consumer), 'utf8')).not.toMatch(/assetsStore|createAssetsStore/);
  }
});
