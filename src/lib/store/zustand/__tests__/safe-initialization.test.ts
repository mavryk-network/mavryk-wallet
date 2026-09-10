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

it('keeps all runtime consumers outside the inactive destination directory on their existing stores', () => {
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
        /(?:from\s*|require\s*\()\s*['"][^'"]*store\/zustand/.test(fs.readFileSync(file, 'utf8'))
      ) {
        consumers.push(path.relative(src, file));
      }
    }
  };
  inspect(src);
  expect(consumers).toEqual([]);
});
