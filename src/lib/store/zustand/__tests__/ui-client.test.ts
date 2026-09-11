import fixture from '../test-support/fixtures/legacy-ui-root.json';
import { memoryStorage } from '../test-support/helpers';

it('foreground waits for the background before reading fallback and never owns a persisted adapter or clobbers ID', async () => {
  const memory = memoryStorage({ analytics_user_id: 'durable-id' });
  let listener!: (...args: unknown[]) => unknown;
  const sender = { id: 'test', url: 'moz-extension://test/popup.html' };
  const read = jest
    .spyOn(Storage.prototype, 'getItem')
    .mockImplementation(key => (key === 'persist:temple-root' ? JSON.stringify(fixture) : null));
  const sendMessage = jest.fn((request: unknown) => listener(JSON.parse(JSON.stringify(request)), sender));
  jest.doMock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
      storage: { local: memory.storage, onChanged: { addListener: jest.fn() } },
      runtime: {
        id: 'test',
        getURL: (path: string) => `moz-extension://test/${path}`,
        onMessage: {
          addListener: (callback: typeof listener) => {
            listener = callback;
          }
        },
        sendMessage
      }
    }
  }));
  let owner!: typeof import('../ui-owner');
  let client!: typeof import('../ui-client');
  jest.isolateModules(() => {
    owner = require('../ui-owner');
    client = require('../ui-client');
  });
  owner.startUIOwner();
  expect(() => client.getOwnedUISnapshot()).toThrow('readiness');
  expect(read).not.toHaveBeenCalled();
  await client.initializeOwnedUI();
  expect(read).toHaveBeenCalledTimes(7);
  expect(sendMessage).toHaveBeenCalledTimes(8);
  expect(client.getOwnedUISnapshot().ui.userId).toBe('durable-id');
  expect(memory.records.analytics_user_id).toBe('durable-id');
  await client.updateOwnedUI({ kind: 'preferences', values: { isNewsEnabled: true } });
  expect(client.getOwnedUISnapshot().ui.isNewsEnabled).toBe(true);
  expect(JSON.parse(memory.records['zustand-ui'] as string).state.isNewsEnabled).toBe(true);
  (memory.storage.get as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(client.updateOwnedUI()).rejects.toThrow('retry');
  expect(() => client.getOwnedUISnapshot()).toThrow('retry');
  await client.initializeOwnedUI();
  expect(client.getOwnedUISnapshot().ui.isNewsEnabled).toBe(true);
  read.mockRestore();
  jest.dontMock('webextension-polyfill');
});
