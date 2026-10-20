/** @jest-environment node */

import type { Runtime } from 'webextension-polyfill';

import keystore from '../test-support/fixtures/test-hd-keystore.json';

jest.mock('lib/i18n', () => ({ t: (key: string) => key }));

// The owner and vault run without a DOM; only the foreground legacy fallback needs localStorage.
beforeAll(() => Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, configurable: true }));
beforeAll(() =>
  Object.defineProperty(global, 'localStorage', {
    value: { getItem: () => null, clear: () => undefined },
    configurable: true
  })
);

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'test-wallet-password';

function setup(initial: Record<string, unknown> = {}) {
  const records = { ...initial };
  const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
  const notify = (keys: string[]) => {
    const changes = Object.fromEntries(keys.map(key => [key, {}]));
    listeners.forEach(listener => listener(changes, 'local'));
  };
  const local = {
    get: jest.fn(async (keys: string | string[] | null) =>
      keys === null
        ? { ...records }
        : Object.fromEntries(
            (typeof keys === 'string' ? [keys] : keys).filter(key => key in records).map(key => [key, records[key]])
          )
    ),
    set: jest.fn(async (items: Record<string, unknown>) => {
      Object.assign(records, items);
      notify(Object.keys(items));
    }),
    remove: jest.fn(async (keys: string | string[]) => {
      const removed = typeof keys === 'string' ? [keys] : keys;
      removed.forEach(key => delete records[key]);
      notify(removed);
    }),
    clear: jest.fn(async () => {
      const keys = Object.keys(records);
      keys.forEach(key => delete records[key]);
      notify(keys);
    })
  };
  let handleMessage!: (request: unknown, sender: Runtime.MessageSender) => Promise<unknown>;
  jest.doMock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
      storage: {
        local,
        session: { clear: jest.fn(), remove: jest.fn() },
        onChanged: {
          addListener: (listener: (changes: Record<string, unknown>, area: string) => void) => listeners.add(listener),
          removeListener: (listener: (changes: Record<string, unknown>, area: string) => void) =>
            listeners.delete(listener)
        }
      },
      runtime: {
        id: 'test',
        getURL: (path: string) => `moz-extension://test/${path}`,
        onMessage: {
          addListener: (listener: typeof handleMessage) => {
            handleMessage = listener;
          }
        },
        sendMessage: async (request: unknown) =>
          JSON.parse(
            JSON.stringify(
              await handleMessage(JSON.parse(JSON.stringify(request)), {
                id: 'test',
                url: 'moz-extension://test/fullpage.html'
              })
            )
          )
      }
    }
  }));
  jest.doMock('lib/temple/back/vault/helpers', () => ({
    ...jest.requireActual('lib/temple/back/vault/helpers'),
    fetchMessage: jest.fn(async (_key: string, substitution?: string) => `Wallet ${substitution ?? ''}`)
  }));
  jest.doMock('lib/apis/tzkt/api', () => ({
    ...jest.requireActual('lib/apis/tzkt/api'),
    getKYCStatus: jest.fn(async () => false)
  }));
  let owner!: typeof import('../ui-owner');
  let client!: typeof import('../ui-client');
  let vault!: typeof import('lib/temple/back/vault');
  let reset!: typeof import('lib/temple/reset');
  let kukai!: typeof import('lib/temple/front/kukai');
  jest.isolateModules(() => {
    owner = require('../ui-owner');
    client = require('../ui-client');
    vault = require('lib/temple/back/vault');
    reset = require('lib/temple/reset');
    kukai = require('lib/temple/front/kukai');
  });
  owner.startUIOwner();
  return { records, local, client, Vault: vault.Vault, reset, kukai };
}

afterEach(() => {
  localStorage.clear();
  jest.dontMock('webextension-polyfill');
  jest.dontMock('lib/temple/back/vault/helpers');
  jest.dontMock('lib/apis/tzkt/api');
});

it.each(['create', 'restore', 'generate', 'hd-file'] as const)(
  'keeps durable preferences through %s registration, storage events and owner restart',
  async flow => {
    const s = setup();
    await s.client.initializeOwnedUI();
    await s.client.updateOwnedUI({ kind: 'preferences', values: { isAnalyticsEnabled: true, isNewsEnabled: false } });
    const before = s.client.getOwnedUISnapshot();
    await s.local.set({ 'obsolete-wallet-key': 'obsolete' });
    const mnemonic =
      flow === 'hd-file' ? await s.kukai.decryptKukaiSeedPhrase(JSON.stringify(keystore), PASSWORD) : MNEMONIC;
    if (flow === 'hd-file') expect(mnemonic).toBe(MNEMONIC);
    const address = await s.Vault.spawn(PASSWORD, flow === 'generate' ? undefined : mnemonic);
    await s.client.updateOwnedUI();
    expect(address).toMatch(/^mv1/);
    expect(s.client.getOwnedUISnapshot()).toEqual(before);
    expect(s.records['obsolete-wallet-key']).toBeUndefined();
    expect(s.local.clear).not.toHaveBeenCalled();
    const unlocked = await s.Vault.setup(PASSWORD);
    expect((await unlocked.fetchAccounts())[0].publicKeyHash).toBe(address);
    await s.client.updateOwnedUI({ kind: 'preferences', values: { shouldShowNewsletterModal: true } });
    const restarted = setup(s.records);
    await restarted.client.initializeOwnedUI();
    expect(restarted.client.getOwnedUISnapshot().ui).toEqual(before.ui);
    expect(restarted.records.analytics_user_id).toBe(before.ui.userId);
    await restarted.Vault.reset(PASSWORD);
    expect(restarted.local.clear).toHaveBeenCalledTimes(1);
    expect(restarted.records).toEqual({});
  },
  30000
);

it('preserves owner writes made while registration cleanup is in progress', async () => {
  const s = setup();
  await s.client.initializeOwnedUI();
  await s.local.set({ obsolete: true });
  const remove = s.local.remove.getMockImplementation()!;
  s.local.remove.mockImplementationOnce(async keys => {
    await s.client.updateOwnedUI({ kind: 'preferences', values: { isNewsEnabled: false } });
    await remove(keys);
  });
  await s.reset.clearAsyncStorages({ shouldPreserveOwnedState: true });
  await s.client.updateOwnedUI();
  expect(s.client.getOwnedUISnapshot().ui.isNewsEnabled).toBe(false);
  expect(JSON.parse(s.records['zustand-ui'] as string).state.isNewsEnabled).toBe(false);
  expect(s.records.obsolete).toBeUndefined();
});

it('propagates cleanup read and removal failures without falling back to clearing owner records', async () => {
  const s = setup({ obsolete: true });
  await s.client.initializeOwnedUI();
  const before = { ...s.records };
  s.local.get.mockRejectedValueOnce(new Error('read failed'));
  await expect(s.reset.clearAsyncStorages({ shouldPreserveOwnedState: true })).rejects.toThrow('read failed');
  s.local.remove.mockRejectedValueOnce(new Error('remove failed'));
  await expect(s.reset.clearAsyncStorages({ shouldPreserveOwnedState: true })).rejects.toThrow('remove failed');
  expect(s.local.clear).not.toHaveBeenCalled();
  expect(s.records).toEqual(before);
});

it('keeps preferences when importing another HD wallet or a mnemonic account into an unlocked wallet', async () => {
  const s = setup();
  await s.client.initializeOwnedUI();
  await s.Vault.spawn(PASSWORD, MNEMONIC);
  const vault = await s.Vault.setup(PASSWORD);
  const before = s.client.getOwnedUISnapshot();
  const otherMnemonic = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
  const imported = await vault.createOrImportWallet(otherMnemonic);
  expect(imported.newAccounts).toHaveLength(2);
  const accounts = await vault.importMnemonicAccount(otherMnemonic, 'test-chain');
  expect(accounts).toHaveLength(3);
  await s.client.updateOwnedUI();
  expect(s.client.getOwnedUISnapshot()).toEqual(before);
  expect(s.local.clear).not.toHaveBeenCalled();
});
