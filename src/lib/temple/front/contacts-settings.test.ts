import { CONTACTS_ENCRYPTION_VERSION } from '../contacts-crypto';
import { TempleAccount, TempleAccountType, TempleChainKind, TempleSettings } from '../types';

import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  canReadLegacyContacts,
  canAccountUseContacts,
  getContactsBookScope,
  getStoredContactsLastSeenVersion,
  getStoredContactsAccountDataKey,
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
  it('scopes contacts to the SEC-02 book address', () => {
    expect(getContactsBookScope(accounts, mainAccount.publicKeyHash)).toEqual({
      status: 'available',
      bookAddr: mainAccount.publicKeyHash
    });
    expect(getContactsBookScope(accounts, derivedAccount.publicKeyHash)).toEqual({
      status: 'available',
      bookAddr: mainAccount.publicKeyHash
    });
    expect(getContactsBookScope(accounts, importedAccount.publicKeyHash)).toEqual({
      status: 'available',
      bookAddr: importedAccount.publicKeyHash
    });
    expect(getContactsBookScope(accounts, ledgerAccount.publicKeyHash)).toEqual({
      status: 'unavailable',
      bookAddr: ledgerAccount.publicKeyHash,
      reason: 'ledger'
    });
  });

  it('stores managed KT contacts under the owner book address', () => {
    expect(getContactsBookScope(accounts, managedKTAccount.publicKeyHash)).toEqual({
      status: 'available',
      bookAddr: mainAccount.publicKeyHash
    });
  });

  it('disables contacts for watch-only and Ledger accounts', () => {
    expect(canAccountUseContacts(watchOnlyAccount)).toBe(false);
    expect(canAccountUseContacts(ledgerAccount)).toBe(false);
    expect(getContactsBookScope(accounts, watchOnlyAccount.publicKeyHash)).toEqual({
      status: 'unavailable',
      bookAddr: watchOnlyAccount.publicKeyHash,
      reason: 'watch-only'
    });
  });

  it('builds account-address keyed contacts settings and preserves inactive account states', () => {
    const mainStorageKey = buildContactsStorageKey(mainAccount.publicKeyHash, 'mainnet');
    const derivedStorageKey = buildContactsStorageKey(derivedAccount.publicKeyHash, 'mainnet');
    const settings: TempleSettings = {
      contacts: [{ name: 'Existing', address: 'mv1-existing' }],
      contactsApi: {
        accounts: {
          [mainStorageKey]: {
            accountDataKey: 'main-key',
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
      accountDataKey: 'main-key',
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
    expect(getStoredContactsAccountDataKey(patch as TempleSettings, derivedStorageKey)).toBeNull();
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

  it('treats a contacts sync error as a settings change', () => {
    const storageKey = buildContactsStorageKey(mainAccount.publicKeyHash, 'mainnet');

    expect(
      hasContactsSettingsAccountPatchMismatch(
        {},
        {
          contactsStorageKey: storageKey,
          contacts: [],
          recordId: null,
          syncError: 'decrypt-failed'
        }
      )
    ).toBe(true);
  });

  it('drops the stored account data key when building a new contacts patch', () => {
    const storageKey = buildContactsStorageKey(mainAccount.publicKeyHash, 'mainnet');
    const patch = buildContactsSettingsPatch(
      {
        contactsApi: {
          accounts: {
            [storageKey]: {
              accountDataKey: 'stored-key',
              contacts: [{ name: 'Existing', address: 'mv1-existing' }],
              recordId: 'record-id'
            }
          }
        }
      },
      storageKey,
      [{ name: 'Next', address: 'mv1-next' }]
    );

    expect(patch.contactsApi?.accounts?.[storageKey]).toEqual({
      contacts: [{ name: 'Next', address: 'mv1-next' }],
      recordId: 'record-id'
    });
  });

  it('preserves the current-version latch when building contacts patches', () => {
    const storageKey = buildContactsStorageKey(mainAccount.publicKeyHash, 'mainnet');
    const patch = buildContactsSettingsPatch(
      {
        contactsApi: {
          accounts: {
            [storageKey]: {
              contacts: [{ name: 'Existing', address: 'mv1-existing' }],
              lastSeenVersion: CONTACTS_ENCRYPTION_VERSION,
              recordId: 'record-id'
            }
          }
        }
      },
      storageKey,
      [{ name: 'Next', address: 'mv1-next' }]
    );

    expect(getStoredContactsLastSeenVersion(patch as TempleSettings, storageKey)).toBe(CONTACTS_ENCRYPTION_VERSION);
    expect(canReadLegacyContacts(patch as TempleSettings, storageKey)).toBe(false);
  });

  it('allows legacy contacts before the current-version latch is set', () => {
    const storageKey = buildContactsStorageKey(mainAccount.publicKeyHash, 'mainnet');

    expect(canReadLegacyContacts({}, storageKey)).toBe(true);
  });
});
