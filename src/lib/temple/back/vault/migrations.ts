import { nanoid } from 'nanoid';

import {
  ACCOUNT_PKH_STORAGE_KEY,
  ADS_VIEWER_ADDRESS_STORAGE_KEY,
  CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY,
  SHOULD_DISABLE_NOT_ACTIVE_NETWORKS_STORAGE_KEY,
  WALLETS_SPECS_STORAGE_KEY
} from 'lib/constants';
import { moveValueInStorage, putToStorage, removeFromStorage } from 'lib/storage';
import * as Passworder from 'lib/temple/passworder';
import {
  TempleAccount,
  TempleAccountType,
  TempleChainKind,
  TempleContact,
  TempleContactApiType,
  TempleContactsAccountState,
  TempleSettings,
  WalletSpecs
} from 'lib/temple/types';

import { fetchMessage } from './helpers';
import { generateCheck, fetchNewAccountName, mnemonicToTezosAccountCreds } from './misc';
import {
  encryptAndSaveMany,
  encryptAndSaveManyLegacy,
  fetchAndDecryptOne,
  fetchAndDecryptOneLegacy,
  getPlainLegacy,
  removeManyLegacy
} from './safe-storage';
import {
  checkStrgKey,
  mnemonicStrgKey,
  accPrivKeyStrgKey,
  accPubKeyStrgKey,
  accountsStrgKey,
  settingsStrgKey,
  walletMnemonicStrgKey
} from './storage-keys';

export const MIGRATIONS = [
  // [1] Fix derivation
  async (password: string) => {
    const passKey = await Passworder.generateKeyLegacy(password);

    const [mnemonic, accounts] = await Promise.all([
      fetchAndDecryptOneLegacy<string>(mnemonicStrgKey, passKey),
      fetchAndDecryptOneLegacy<TempleAccount[]>(accountsStrgKey, passKey)
    ]);
    const migratedAccounts = accounts.map(acc =>
      acc.type === TempleAccountType.HD
        ? {
            ...acc,
            type: TempleAccountType.Imported
          }
        : acc
    );

    const hdAccIndex = 0;
    const tezosAcc = await mnemonicToTezosAccountCreds(mnemonic, hdAccIndex);

    const newInitialAccount: LegacyTypes.TempleAccount = {
      type: TempleAccountType.HD,
      name: await fetchNewAccountName(accounts, TempleAccountType.HD),
      publicKeyHash: tezosAcc.publicKey,
      hdIndex: hdAccIndex
    };
    const newAccounts = [newInitialAccount, ...migratedAccounts];

    await encryptAndSaveManyLegacy(
      [
        [accPrivKeyStrgKey(tezosAcc.address), tezosAcc.privateKey],
        [accPubKeyStrgKey(tezosAcc.address), tezosAcc.publicKey],
        [accountsStrgKey, newAccounts]
      ],
      passKey
    );
  },

  // [2] Add hdIndex prop to HD Accounts
  async (password: string) => {
    const passKey = await Passworder.generateKeyLegacy(password);
    const accounts = await fetchAndDecryptOneLegacy<TempleAccount[]>(accountsStrgKey, passKey);

    let hdAccIndex = 0;
    const newAccounts = accounts.map(acc =>
      acc.type === TempleAccountType.HD ? { ...acc, hdIndex: hdAccIndex++ } : acc
    );

    await encryptAndSaveManyLegacy([[accountsStrgKey, newAccounts]], passKey);
  },

  // [3] Improve token managing flow
  // Migrate from tokens{netId}: TempleToken[] + hiddenTokens{netId}: TempleToken[]
  // to tokens{chainId}: TempleToken[]
  async () => {
    // The code base for this migration has been removed
    // because it is no longer needed,
    // but this migration is required for version compatibility.
  },

  // [4] Improve crypto security
  // Migrate legacy crypto storage
  // New crypto updates:
  // - Use password hash in memory when unlocked(instead of plain password)
  // - Wrap storage keys in sha256(instead of plain)
  // - Concat storage values to bytes(instead of json)
  // - Increase PBKDF rounds
  async (password: string) => {
    const legacyPassKey = await Passworder.generateKeyLegacy(password);

    const fetchLegacySafe = async <T>(storageKey: string) => {
      try {
        return await fetchAndDecryptOneLegacy<T>(storageKey, legacyPassKey);
      } catch {
        return undefined;
      }
    };

    const [mnemonic, accounts, settings] = await Promise.all([
      fetchLegacySafe<string>(mnemonicStrgKey),
      fetchLegacySafe<LegacyTypes.TempleAccount[]>(accountsStrgKey),
      fetchLegacySafe<TempleSettings>(settingsStrgKey)
    ]);

    // Address book contacts migration
    const contacts = await getPlainLegacy<TempleContact[]>('contacts');
    const [selectedAccountPkh, selectedNetworkId] = await Promise.all([
      getPlainLegacy<string>(ACCOUNT_PKH_STORAGE_KEY),
      getPlainLegacy<string>('network_id')
    ]);

    if (!accounts) {
      return;
    }

    const accountsStrgKeys = accounts
      .map(acc => [accPrivKeyStrgKey(acc.publicKeyHash), accPubKeyStrgKey(acc.publicKeyHash)])
      .flat();

    const accountsStrgValues = await Promise.all(accountsStrgKeys.map(fetchLegacySafe));

    const accountValuesToSave: [string, unknown][] = accountsStrgKeys.map((key, i) => [key, accountsStrgValues[i]]);

    const toSave: [string, unknown][] = [
      [checkStrgKey, generateCheck()],
      [mnemonicStrgKey, mnemonic],
      [accountsStrgKey, accounts],
      [
        settingsStrgKey,
        migrateLegacyContactsSettings(settings, accounts, contacts, selectedAccountPkh, selectedNetworkId)
      ],
      ...accountValuesToSave
    ].filter(([_key, value]) => value !== undefined);

    // Save new storage items
    const passKey = await Passworder.generateKey(password);
    await encryptAndSaveMany(toSave, passKey);

    // Remove old
    await removeManyLegacy([...toSave.map(([key]) => key), 'contacts']);
  },

  // [5] Extend data formats for EVM support
  async (password: string) => {
    console.log('VAULT.MIGRATIONS: migration started');
    const passKey = await Passworder.generateKey(password);

    /* ACCOUNTS */
    const accounts = await fetchAndDecryptOne<LegacyTypes.TempleAccount[]>(accountsStrgKey, passKey);
    const mnemonic = await fetchAndDecryptOne<string>(mnemonicStrgKey, passKey);

    const toEncryptAndSave: [string, any][] = [];
    const walletId = nanoid();
    const hdWalletName = await fetchMessage('hdWalletDefaultName', 'A');

    const newAccounts = accounts.map<TempleAccount>(account => {
      const id = nanoid();

      switch (account.type) {
        case TempleAccountType.HD:
          return { ...account, id, walletId, isKYC: undefined };
        case TempleAccountType.Imported:
          return { ...account, id, chain: TempleChainKind.Tezos, isKYC: undefined };
        case TempleAccountType.WatchOnly:
          return { ...account, id, chain: TempleChainKind.Tezos, isKYC: false };
        case TempleAccountType.Ledger:
          return { ...account, id, chain: TempleChainKind.Tezos, isKYC: undefined };
        case TempleAccountType.ManagedKT:
          return { ...account, id, isKYC: undefined };
      }

      return account;
    });

    toEncryptAndSave.push([accountsStrgKey, newAccounts], [walletMnemonicStrgKey(walletId), mnemonic]);
    await putToStorage<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY, {
      [walletId]: { name: hdWalletName, createdAt: Date.now() }
    });

    moveValueInStorage(ACCOUNT_PKH_STORAGE_KEY, ADS_VIEWER_ADDRESS_STORAGE_KEY);

    await encryptAndSaveMany(toEncryptAndSave, passKey);
    await putToStorage(SHOULD_DISABLE_NOT_ACTIVE_NETWORKS_STORAGE_KEY, true);

    /* CLEAN-UP */

    removeFromStorage(['network_id', 'tokens_base_metadata', 'block_explorer', CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY]);

    console.log('VAULT.MIGRATIONS: EVM migration finished');
  },

  // [6] Prepare to extend public accounts data
  async () => {
    await removeFromStorage(ADS_VIEWER_ADDRESS_STORAGE_KEY);
  },

  // [7] Scope contacts storage by auth wallet and selected network
  async (password: string) => {
    const passKey = await Passworder.generateKey(password);
    const [accounts, settings, selectedAccountPkh, selectedNetworkId] = await Promise.all([
      fetchAndDecryptOne<TempleAccount[]>(accountsStrgKey, passKey),
      fetchAndDecryptOne<TempleSettings>(settingsStrgKey, passKey).catch(() => undefined),
      getPlainLegacy<string>(ACCOUNT_PKH_STORAGE_KEY),
      getPlainLegacy<string>('network_id')
    ]);

    if (!settings || !shouldMigrateContactsSettings(settings)) {
      return;
    }

    const migratedSettings = migrateContactsSettings(settings, accounts, selectedAccountPkh, selectedNetworkId);

    await encryptAndSaveMany([[settingsStrgKey, migratedSettings]], passKey);
  }
];

const DEFAULT_CONTACTS_NETWORK_ID = 'mainnet';
const SCOPED_CONTACTS_KEY_PATTERN = /^\[[^\]]+\]\[[^\]]+\]$/;

type ContactsMigrationAccount = Pick<TempleAccount, 'type' | 'publicKeyHash' | 'hdIndex'> & {
  walletId?: string;
};

function shouldMigrateContactsSettings(settings: TempleSettings) {
  const contactsAccounts = settings.contactsApi?.accounts ?? {};

  return (
    Boolean(settings.contacts?.length) || Object.keys(contactsAccounts).some(key => !isScopedContactsStorageKey(key))
  );
}

function migrateLegacyContactsSettings(
  settings: TempleSettings | undefined,
  accounts: ContactsMigrationAccount[] | undefined,
  contacts: TempleContact[] | null | undefined,
  selectedAccountPkh?: string | null,
  selectedNetworkId?: string | null
) {
  const normalizedContacts = normalizeContacts(contacts ?? []);
  const contactsStorageKey = resolveContactsStorageKey(accounts ?? [], selectedAccountPkh, selectedNetworkId);

  if (!contactsStorageKey || normalizedContacts.length === 0) {
    return normalizedContacts.length > 0 ? { ...settings, contacts: normalizedContacts } : settings;
  }

  return {
    ...settings,
    contacts: normalizedContacts,
    contactsApi: {
      accounts: {
        ...(settings?.contactsApi?.accounts ?? {}),
        [contactsStorageKey]: { contacts: normalizedContacts }
      }
    }
  };
}

function migrateContactsSettings(
  settings: TempleSettings,
  accounts: ContactsMigrationAccount[],
  selectedAccountPkh?: string | null,
  selectedNetworkId?: string | null
) {
  const scopedAccounts = Object.entries(settings.contactsApi?.accounts ?? {}).reduce<
    Record<string, TempleContactsAccountState>
  >((result, [storageKey, state]) => {
    const normalizedState = normalizeContactsAccountState(state);

    if (!normalizedState) {
      return result;
    }

    if (isScopedContactsStorageKey(storageKey)) {
      result[storageKey] = mergeContactsAccountStates(result[storageKey], normalizedState, true);
      return result;
    }

    const ownerAddress = resolveContactsOwnerAddress(accounts, storageKey, false);
    const scopedStorageKey = buildScopedContactsStorageKey(
      ownerAddress ?? storageKey,
      selectedNetworkId ?? DEFAULT_CONTACTS_NETWORK_ID
    );
    const canPreserveRecordId = ownerAddress === storageKey;

    result[scopedStorageKey] = mergeContactsAccountStates(
      result[scopedStorageKey],
      normalizedState,
      canPreserveRecordId
    );

    return result;
  }, {});

  if (Object.keys(scopedAccounts).length === 0 && settings.contacts?.length) {
    const contactsStorageKey = resolveContactsStorageKey(accounts, selectedAccountPkh, selectedNetworkId);

    if (contactsStorageKey) {
      scopedAccounts[contactsStorageKey] = { contacts: normalizeContacts(settings.contacts) };
    }
  }

  const selectedContactsStorageKey = resolveContactsStorageKey(accounts, selectedAccountPkh, selectedNetworkId);

  if (selectedContactsStorageKey && settings.contacts?.length && !scopedAccounts[selectedContactsStorageKey]) {
    scopedAccounts[selectedContactsStorageKey] = { contacts: normalizeContacts(settings.contacts) };
  }

  const selectedContacts =
    (selectedContactsStorageKey && scopedAccounts[selectedContactsStorageKey]?.contacts) ??
    normalizeContacts(settings.contacts ?? []);

  return {
    ...settings,
    contacts: selectedContacts,
    contactsApi: Object.keys(scopedAccounts).length > 0 ? { accounts: scopedAccounts } : undefined
  };
}

function resolveContactsStorageKey(
  accounts: ContactsMigrationAccount[],
  selectedAccountPkh?: string | null,
  selectedNetworkId?: string | null
) {
  const ownerAddress = resolveContactsOwnerAddress(accounts, selectedAccountPkh);

  return ownerAddress
    ? buildScopedContactsStorageKey(ownerAddress, selectedNetworkId ?? DEFAULT_CONTACTS_NETWORK_ID)
    : null;
}

function resolveContactsOwnerAddress(
  accounts: ContactsMigrationAccount[],
  accountPkh?: string | null,
  allowFallback = true
) {
  const selectedAccount =
    (accountPkh && accounts.find(account => account.publicKeyHash === accountPkh)) ||
    (allowFallback
      ? accounts.find(
          account => account.type !== TempleAccountType.WatchOnly && account.type !== TempleAccountType.ManagedKT
        ) ?? accounts[0]
      : undefined);

  if (!selectedAccount) {
    return null;
  }

  if (selectedAccount.type !== TempleAccountType.HD) {
    return selectedAccount.publicKeyHash;
  }

  const sameWalletMainAccount =
    'walletId' in selectedAccount && selectedAccount.walletId
      ? accounts.find(
          account =>
            account.type === TempleAccountType.HD &&
            'walletId' in account &&
            account.walletId === selectedAccount.walletId &&
            account.hdIndex === 0
        )
      : accounts.find(account => account.type === TempleAccountType.HD && account.hdIndex === 0);

  return sameWalletMainAccount?.publicKeyHash ?? selectedAccount.publicKeyHash;
}

function buildScopedContactsStorageKey(walletAddress: string, networkId: string) {
  return `[${walletAddress}][${networkId}]`;
}

function isScopedContactsStorageKey(storageKey: string) {
  return SCOPED_CONTACTS_KEY_PATTERN.test(storageKey);
}

function normalizeContactsAccountState(
  state: TempleContactsAccountState | undefined
): TempleContactsAccountState | null {
  if (!state) {
    return null;
  }

  const contacts = normalizeContacts(state.contacts);
  const typesByAddress = normalizeTypesByAddress(state.typesByAddress, contacts);

  if (contacts.length === 0 && !state.recordId && !typesByAddress) {
    return null;
  }

  return {
    contacts,
    ...(state.recordId ? { recordId: state.recordId } : {}),
    ...(typesByAddress ? { typesByAddress } : {})
  };
}

function mergeContactsAccountStates(
  currentState: TempleContactsAccountState | undefined,
  incomingState: TempleContactsAccountState,
  canPreserveRecordId: boolean
) {
  const contacts = normalizeContacts([...(currentState?.contacts ?? []), ...incomingState.contacts]);
  const typesByAddress = normalizeTypesByAddress(
    { ...(currentState?.typesByAddress ?? {}), ...(incomingState.typesByAddress ?? {}) },
    contacts
  );
  const recordId = currentState?.recordId ?? (canPreserveRecordId ? incomingState.recordId : undefined);

  return {
    contacts,
    ...(recordId ? { recordId } : {}),
    ...(typesByAddress ? { typesByAddress } : {})
  };
}

function normalizeContacts(contacts: TempleContact[]) {
  const uniqueContacts = new Map<string, TempleContact>();

  contacts.forEach(contact => {
    const name = contact.name.trim();
    const address = contact.address.trim();

    if (!name || !address || uniqueContacts.has(address)) {
      return;
    }

    uniqueContacts.set(
      address,
      typeof contact.addedAt === 'number' ? { name, address, addedAt: contact.addedAt } : { name, address }
    );
  });

  return Array.from(uniqueContacts.values());
}

function normalizeTypesByAddress(
  typesByAddress: Record<string, TempleContactApiType> | undefined,
  contacts: TempleContact[]
) {
  if (!typesByAddress || Object.keys(typesByAddress).length === 0) {
    return undefined;
  }

  const contactAddresses = new Set(contacts.map(contact => contact.address));
  const normalizedTypes = Object.entries(typesByAddress).reduce<Record<string, TempleContactApiType>>(
    (result, [address, type]) => {
      if (contactAddresses.has(address)) {
        result[address] = type;
      }

      return result;
    },
    {}
  );

  return Object.keys(normalizedTypes).length > 0 ? normalizedTypes : undefined;
}

namespace LegacyTypes {
  export type TempleAccount =
    | TempleHDAccount
    | TempleImportedAccount
    | TempleLedgerAccount
    | TempleManagedKTAccount
    | TempleWatchOnlyAccount;

  interface TempleLedgerAccount extends TempleAccountBase {
    type: TempleAccountType.Ledger;
    derivationPath: string;
  }

  interface TempleImportedAccount extends TempleAccountBase {
    type: TempleAccountType.Imported;
  }

  interface TempleHDAccount extends TempleAccountBase {
    type: TempleAccountType.HD;
    hdIndex: number;
  }

  interface TempleManagedKTAccount extends TempleAccountBase {
    type: TempleAccountType.ManagedKT;
    chainId: string;
    owner: string;
  }

  interface TempleWatchOnlyAccount extends TempleAccountBase {
    type: TempleAccountType.WatchOnly;
    chainId?: string;
  }

  interface TempleAccountBase {
    type: TempleAccountType;
    name: string;
    publicKeyHash: string;
    hdIndex?: number;
    derivationPath?: string;
    derivationType?: 0 | 1 | 2 | 3;
  }
}
