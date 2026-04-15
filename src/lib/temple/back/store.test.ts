import browser from 'webextension-polyfill';

import { TempleAccountType, TempleChainKind, TempleStatus } from '../types';

import { accountsUpdated, inited, locked, settingsUpdated, store, unlocked } from './store';
import { Vault } from './vault';

describe('Store tests', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    store.setState(
      {
        inited: false,
        vault: null,
        status: TempleStatus.Idle,
        accounts: [],
        networks: [],
        settings: null
      },
      true
    );
  });

  it('Browser storage works well', async () => {
    await browser.storage.local.set({ kek: 'KEK' });
    const items = await browser.storage.local.get('kek');
    expect(items.kek).toBe('KEK');
  });

  it('Initial store values', () => {
    const { inited: isInited, vault, status, accounts, networks, settings } = store.getState();
    expect(isInited).toBeFalsy();
    expect(vault).toBeNull();
    expect(status).toBe(TempleStatus.Idle);
    expect(accounts).toEqual([]);
    expect(networks).toEqual([]);
    expect(settings).toBeNull();
  });
  it('Inited event', () => {
    inited(false);
    const { inited: isInited, status } = store.getState();
    expect(isInited).toBeTruthy();
    expect(status).toBe(TempleStatus.Idle);
  });
  it('Inited event with Vault', () => {
    inited(true);
    const { status } = store.getState();
    expect(status).toBe(TempleStatus.Locked);
  });
  it('Locked event', () => {
    locked();
    const { status } = store.getState();
    expect(status).toBe(TempleStatus.Locked);
  });
  it('Unlocked event', () => {
    unlocked({ vault: {} as Vault, accounts: [], settings: {} });
    const { status } = store.getState();
    expect(status).toBe(TempleStatus.Ready);
  });
  it('Accounts updated event', () => {
    accountsUpdated([
      {
        id: 'testId',
        name: 'testName',
        type: TempleAccountType.Imported,
        publicKeyHash: 'testHashKey',
        chain: TempleChainKind.Tezos,
        isKYC: undefined
      }
    ]);
    const { accounts } = store.getState();
    const { name, type, publicKeyHash } = accounts[0];
    expect(name).toBe('testName');
    expect(type).toBe(TempleAccountType.Imported);
    expect(publicKeyHash).toBe('testHashKey');
  });
  it('Settings updated event', () => {
    settingsUpdated({});
    const { settings } = store.getState();
    expect(settings).toEqual({});
  });
});
