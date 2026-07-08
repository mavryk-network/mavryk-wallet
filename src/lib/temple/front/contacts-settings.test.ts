import { TempleAccount, TempleAccountType, TempleChainKind, TempleSettings } from '../types';

import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  canAccountUseContacts,
  getContactsAccountScope,
  hasContactsSettingsAccountPatchMismatch
} from './contacts-settings';

const mainAccount: TempleAccount = {
  id: 'hd-main',
  type: TempleAccountType.HD,
  name: 'Main',
  publicKeyHash: 'mv1-main',
  hdIndex: 0,
  walletId: 'wallet-1',
  isKYC: undefined
};

const derivedAccount: TempleAccount = {
  id: 'hd-derived',
  type: TempleAccountType.HD,
  name: 'Derived',
  publicKeyHash: 'mv1-derived',
  hdIndex: 1,
  walletId: 'wallet-1',
  isKYC: undefined
};

const importedAccount: TempleAccount = {
  id: 'imported',
  type: TempleAccountType.Imported,
  name: 'Imported',
  publicKeyHash: 'mv1-imported',
  chain: TempleChainKind.Tezos,
  isKYC: undefined
};

const ledgerAccount: TempleAccount = {
  id: 'ledger',
  type: TempleAccountType.Ledger,
  name: 'Ledger',
  publicKeyHash: 'mv1-ledger',
  chain: TempleChainKind.Tezos,
  derivationPath: "44'/1969'/0'/0'",
  isKYC: undefined
};

const managedKTAccount: TempleAccount = {
  id: 'managed-kt',
  type: TempleAccountType.ManagedKT,
  name: 'Managed KT',
  publicKeyHash: 'KT1-managed',
  chainId: 'NetXXAAR1wWQhhe',
  owner: derivedAccount.publicKeyHash,
  isKYC: undefined
};

const watchOnlyAccount: TempleAccount = {
  id: 'watch-only',
  type: TempleAccountType.WatchOnly,
  name: 'Watch only',
  publicKeyHash: 'mv1-watch',
  chain: TempleChainKind.Tezos,
  isKYC: undefined
};

const accounts = [mainAccount, derivedAccount, importedAccount, ledgerAccount, managedKTAccount, watchOnlyAccount];

describe('contacts-settings', () => {
  it('scopes contacts to each supported account address', () => {
    expect(getContactsAccountScope(accounts, mainAccount.publicKeyHash)).toEqual({
      storageAddress: mainAccount.publicKeyHash,
      authAddress: mainAccount.publicKeyHash
    });
    expect(getContactsAccountScope(accounts, derivedAccount.publicKeyHash)).toEqual({
      storageAddress: derivedAccount.publicKeyHash,
      authAddress: derivedAccount.publicKeyHash
    });
    expect(getContactsAccountScope(accounts, importedAccount.publicKeyHash)).toEqual({
      storageAddress: importedAccount.publicKeyHash,
      authAddress: importedAccount.publicKeyHash
    });
    expect(getContactsAccountScope(accounts, ledgerAccount.publicKeyHash)).toEqual({
      storageAddress: ledgerAccount.publicKeyHash,
      authAddress: ledgerAccount.publicKeyHash
    });
  });

  it('stores managed KT contacts under the KT address and authenticates through its owner', () => {
    expect(getContactsAccountScope(accounts, managedKTAccount.publicKeyHash)).toEqual({
      storageAddress: managedKTAccount.publicKeyHash,
      authAddress: derivedAccount.publicKeyHash
    });
  });

  it('disables contacts for watch-only accounts', () => {
    expect(canAccountUseContacts(watchOnlyAccount)).toBe(false);
    expect(getContactsAccountScope(accounts, watchOnlyAccount.publicKeyHash)).toBeNull();
  });

  it('builds account-address keyed contacts settings and preserves inactive account states', () => {
    const mainStorageKey = buildContactsStorageKey(mainAccount.publicKeyHash, 'mainnet');
    const derivedStorageKey = buildContactsStorageKey(derivedAccount.publicKeyHash, 'mainnet');
    const settings: TempleSettings = {
      contacts: [{ name: 'Existing', address: 'mv1-existing' }],
      contactsApi: {
        accounts: {
          [mainStorageKey]: {
            contacts: [{ name: 'Main Contact', address: 'mv1-main-contact' }],
            recordId: 'main-record'
          }
        }
      }
    };

    const patch = buildContactsSettingsPatch(
      settings,
      derivedStorageKey,
      [{ name: 'Derived Contact', address: 'mv1-derived-contact' }],
      'derived-record',
      {
        'mv1-derived-contact': 'user',
        'mv1-removed-contact': 'validator'
      }
    );

    expect(patch.contacts).toEqual([{ name: 'Derived Contact', address: 'mv1-derived-contact' }]);
    expect(patch.contactsApi?.accounts?.[mainStorageKey]).toEqual({
      contacts: [{ name: 'Main Contact', address: 'mv1-main-contact' }],
      recordId: 'main-record'
    });
    expect(patch.contactsApi?.accounts?.[derivedStorageKey]).toEqual({
      contacts: [{ name: 'Derived Contact', address: 'mv1-derived-contact' }],
      recordId: 'derived-record',
      typesByAddress: {
        'mv1-derived-contact': 'user'
      }
    });
  });

  it('does not treat missing empty contacts state as a settings change', () => {
    const storageKey = buildContactsStorageKey(mainAccount.publicKeyHash, 'mainnet');

    expect(
      hasContactsSettingsAccountPatchMismatch(
        {},
        {
          contactsStorageKey: storageKey,
          contacts: [],
          recordId: null
        }
      )
    ).toBe(false);
  });

  it('treats remote empty contacts as a change when cached contacts exist', () => {
    const storageKey = buildContactsStorageKey(mainAccount.publicKeyHash, 'mainnet');

    expect(
      hasContactsSettingsAccountPatchMismatch(
        {
          contactsApi: {
            accounts: {
              [storageKey]: {
                contacts: [{ name: 'Existing', address: 'mv1-existing' }],
                recordId: 'record-id'
              }
            }
          }
        },
        {
          contactsStorageKey: storageKey,
          contacts: [],
          recordId: null
        }
      )
    ).toBe(true);
  });
});
