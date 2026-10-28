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
  expect(read).toHaveBeenCalledTimes(9);
  expect(sendMessage).toHaveBeenCalledTimes(10);
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

it('page entry starts the owner request once; StoreProvider adopts it and a retry asks the owner again', async () => {
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
  client.startOwnedUIInitialization();
  client.startOwnedUIInitialization();
  const sentAtEntry = sendMessage.mock.calls.length;
  expect(sentAtEntry).toBe(1);
  await client.initializeOwnedUI();
  const sentByEarlyRequest = sendMessage.mock.calls.length;
  expect(client.getOwnedUISnapshot().ui.userId).toBe('durable-id');
  await client.initializeOwnedUI();
  expect(sendMessage.mock.calls.length).toBeGreaterThan(sentByEarlyRequest);
  read.mockRestore();
  jest.dontMock('webextension-polyfill');
});

function startOwnerAndClient() {
  const memory = memoryStorage({ analytics_user_id: 'durable-id' });
  let listener!: (...args: unknown[]) => unknown;
  const changeListeners: ((changes: Record<string, unknown>, area: string) => void)[] = [];
  const sender = { id: 'test', url: 'moz-extension://test/popup.html' };
  const read = jest
    .spyOn(Storage.prototype, 'getItem')
    .mockImplementation(key => (key === 'persist:temple-root' ? JSON.stringify(fixture) : null));
  const sendMessage = jest.fn((request: unknown) => listener(JSON.parse(JSON.stringify(request)), sender));
  jest.doMock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
      storage: {
        local: memory.storage,
        onChanged: { addListener: (callback: (typeof changeListeners)[number]) => changeListeners.push(callback) }
      },
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
  let react!: Pick<typeof import('react'), 'createElement'> &
    Pick<typeof import('react-dom/client'), 'createRoot'> &
    Pick<typeof import('react-dom/test-utils'), 'act'>;
  jest.isolateModules(() => {
    owner = require('../ui-owner');
    client = require('../ui-client');
    // The same isolated registry as the client, so hooks run against one React instance.
    react = { ...require('react'), ...require('react-dom/client'), ...require('react-dom/test-utils') };
  });
  owner.startUIOwner();
  const emitChange = (key: string) => changeListeners.forEach(callback => callback({ [key]: {} }, 'local'));
  const cleanup = () => {
    read.mockRestore();
    jest.dontMock('webextension-polyfill');
  };
  return { client, react, sendMessage, emitChange, cleanup };
}

it('keeps unchanged snapshot slices by identity and re-renders only consumers whose slice changed', async () => {
  const { client, react, cleanup } = startOwnerAndClient();
  await client.initializeOwnedUI();
  const first = client.getOwnedUISnapshot();
  await client.updateOwnedUI();
  expect(client.getOwnedUISnapshot()).toBe(first);

  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { createElement, createRoot, act } = react;
  const renders = { news: 0, assets: 0 };
  function NewsConsumer() {
    renders.news++;
    client.useOwnedUI(({ ui }) => ui.isNewsEnabled);
    return null;
  }
  function AssetsConsumer() {
    renders.assets++;
    client.useOwnedUI(({ assets }) => assets.tokens);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () =>
    root.render(createElement('div', null, createElement(NewsConsumer), createElement(AssetsConsumer)))
  );
  expect(renders).toEqual({ news: 1, assets: 1 });

  await act(() => client.updateOwnedUI());
  expect(renders).toEqual({ news: 1, assets: 1 });

  await act(() => client.updateOwnedUI({ kind: 'preferences', values: { isNewsEnabled: true } }));
  const next = client.getOwnedUISnapshot();
  expect(next).not.toBe(first);
  expect(next.ui.isNewsEnabled).toBe(true);
  expect(next.assets).toBe(first.assets);
  expect(next.metadata).toBe(first.metadata);
  expect(renders).toEqual({ news: 2, assets: 1 });
  await act(async () => root.unmount());
  cleanup();
});

it('coalesces storage-change refreshes that are still queued, and refreshes again after one was sent', async () => {
  const { client, sendMessage, emitChange, cleanup } = startOwnerAndClient();
  await client.initializeOwnedUI();
  const before = sendMessage.mock.calls.length;
  const command = client.updateOwnedUI({ kind: 'preferences', values: { isNewsEnabled: true } });
  emitChange('zustand-ui');
  emitChange('zustand-balances');
  emitChange('zustand-metadata');
  await command;
  await client.updateOwnedUI();
  expect(sendMessage.mock.calls.length - before).toBe(3); // command, one coalesced refresh, explicit read

  // The queue is idle, so this refresh is sent at once; a later change must queue a new one.
  emitChange('zustand-ui');
  emitChange('zustand-ui');
  await client.updateOwnedUI();
  expect(sendMessage.mock.calls.length - before).toBe(6);
  expect(client.getOwnedUISnapshot().ui.isNewsEnabled).toBe(true);
  cleanup();
});
