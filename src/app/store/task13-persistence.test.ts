import { memoryStorage } from 'lib/store/zustand/test-support/helpers';

jest.mock('lib/apis/temple', () => require('lib/apis/temple/ab-test-group.enum'));
jest.mock('lib/notifications/store/epics', () => ({ notificationsEpics: jest.fn() }));
jest.mock('@redux-devtools/remote', () => ({ devToolsEnhancer: jest.fn() }));

function setup(records: Record<string, unknown>) {
  jest.resetModules();
  const memory = memoryStorage(records);
  jest.doMock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
      storage: { local: memory.storage, onChanged: { addListener: jest.fn() } }
    }
  }));
  jest.doMock('./root-state.epics', () => {
    const epicMiddleware = () => (next: (action: unknown) => unknown) => (action: unknown) => next(action);
    epicMiddleware.run = jest.fn();
    return { epicMiddleware, rootEpic: jest.fn() };
  });
  let app!: typeof import('./index');
  jest.isolateModules(() => {
    app = require('./index');
  });
  return { ...memory, app };
}

async function start(app: typeof import('./index')) {
  await app.initializeReduxPersistence();
  await new Promise<void>(resolve => {
    if (app.persistor.getState().bootstrapped) return resolve();
    const unsubscribe = app.persistor.subscribe(() => {
      if (app.persistor.getState().bootstrapped) {
        unsubscribe();
        resolve();
      }
    });
  });
  await app.persistor.flush();
}

afterEach(() => {
  jest.dontMock('webextension-polyfill');
  jest.dontMock('./root-state.epics');
});

it('boots fresh Redux, seeds security once, preserves unrelated state and never writes any nested legacy key', async () => {
  const legacy = {
    'persist:root.assets': { mainnetWhitelist: { data: ['safe'] }, mainnetScamlist: { data: { scam: true } } },
    'persist:root.collectibles': { adultFlags: { nft: { val: true, ts: 1 } } },
    'persist:root.rwas': { adultFlags: {} },
    'persist:root.collectiblesMetadata': { records: [] },
    'persist:root.rwasMetadata': { records: [] },
    'persist:root.partnersPromotion': { shouldShowPromotion: true, promotionHidingTimestamps: {} },
    analytics_user_id: 'keep',
    'zustand-ui': 'untouched',
    MIGRATIONS: ['keep']
  };
  const s = setup(legacy);
  await start(s.app);
  expect(s.app.store.getState().assets.mainnetScamlist.data).toEqual({ scam: true });
  const { loadTokensScamlistActions } = require('./assets/actions');
  s.app.store.dispatch(loadTokensScamlistActions.success({ newer: true }));
  await s.app.persistor.flush();
  const active = s.records['persist:temple-root-task11'] as {
    assets: { mainnetScamlist: { data: object } };
    currency: object;
  };
  expect(active.assets.mainnetScamlist.data).toEqual({ newer: true });
  expect(active.currency).toEqual(s.app.store.getState().currency);
  for (const [key, value] of Object.entries(legacy)) expect(s.records[key]).toEqual(value);
  expect(
    (s.storage.set as jest.Mock).mock.calls.every(([items]) =>
      Object.keys(items).every(key => key === 'persist:temple-root-task11')
    )
  ).toBe(true);
  s.app.persistor.pause();
  const reload = setup(s.records);
  await start(reload.app);
  expect(reload.app.store.getState().assets.mainnetScamlist.data).toEqual({ newer: true });
  reload.app.persistor.pause();
});

it('keeps Redux persistence stopped on a rejected security source read and allows explicit retry', async () => {
  const s = setup({});
  (s.storage.get as jest.Mock).mockImplementation(async key => {
    if (key === 'persist:root.assets') throw new Error('read failure');
    return {};
  });
  await expect(s.app.initializeReduxPersistence()).rejects.toThrow('read failure');
  expect(s.app.persistor.getState().bootstrapped).toBe(false);
  expect(s.storage.set).not.toHaveBeenCalled();
  (s.storage.get as jest.Mock).mockResolvedValue({});
  await start(s.app);
  expect(s.app.persistor.getState().bootstrapped).toBe(true);
  s.app.persistor.pause();
});
