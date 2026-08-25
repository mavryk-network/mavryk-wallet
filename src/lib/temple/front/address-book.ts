import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import { getMessage } from 'lib/i18n';
import { CONTACTS_ENCRYPTION_VERSION } from 'lib/temple/contacts-crypto';
import { TempleContact, TempleContactApiType } from 'lib/temple/types';
import { CurrentContactsRecordDecryptionError, fetchContactsRecord, saveContactsRecord } from 'mavryk/api/contacts';

import { isAddressValid, isKTAddress } from '../helpers';

import { useKnownBakers } from './baking/baking';
import { PREDEFINED_BAKERS_NAMES_MAINNET } from './baking/const';
import { useTempleClient } from './client';
import { getContactsUnavailableMessage } from './contacts-availability';
import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  canReadLegacyContacts,
  canUseEncryptedContacts,
  getCachedContactsState,
  getContactsBookScope,
  getStoredContactsAccountDataKey,
  getStoredContactsRecordId,
  getStoredContactsTypesByAddress,
  normalizeContacts
} from './contacts-settings';
import { useAccount, useAllAccounts, useNetwork, useSettings } from './ready';
import { useFilteredContacts } from './use-filtered-contacts.hook';

function isPredefinedValidatorAddress(address: string) {
  return PREDEFINED_BAKERS_NAMES_MAINNET[address] !== undefined;
}

type ContactsRecordState = Awaited<ReturnType<typeof fetchContactsRecord>>;
type CachedContactsState = ReturnType<typeof getCachedContactsState>;

function hasContactsServerBinding(cachedState: CachedContactsState) {
  return Boolean(cachedState?.recordId);
}

function mergeCachedAndRemoteContactsState(
  cachedState: NonNullable<CachedContactsState>,
  remoteState: ContactsRecordState
): ContactsRecordState {
  const typesByAddress = {
    ...(remoteState.typesByAddress ?? {}),
    ...(cachedState.typesByAddress ?? {})
  };

  return {
    ...remoteState,
    contacts: normalizeContacts([...cachedState.contacts, ...remoteState.contacts]),
    ...(Object.keys(typesByAddress).length > 0 ? { typesByAddress } : {})
  };
}

export function useContactsActions() {
  const { deriveContactsKey, ensureAuthorized, revealPublicKey, updateSettings } = useTempleClient();
  const account = useAccount();
  const allAccounts = useAllAccounts();
  const network = useNetwork();
  const knownBakers = useKnownBakers(false);
  const settings = useSettings();
  const { allContacts } = useFilteredContacts();
  const settingsRef = useRef(settings);
  const contactsBookScope = useMemo(
    () => getContactsBookScope(allAccounts, account.publicKeyHash),
    [account.publicKeyHash, allAccounts]
  );
  const contactsStorageKey =
    contactsBookScope.status === 'available' ? buildContactsStorageKey(contactsBookScope.bookAddr, network.id) : null;
  const knownValidatorAddresses = useMemo(
    () => new Set((knownBakers ?? []).map(({ address }) => address)),
    [knownBakers]
  );

  // Keep the latest settings available for contact actions without rebuilding callbacks.
  // No cleanup is needed because this only updates an in-memory ref.
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const isKnownValidatorAddress = useCallback(
    (address: string) =>
      knownValidatorAddresses.has(address) || (network.type === 'main' && isPredefinedValidatorAddress(address)),
    [knownValidatorAddresses, network.type]
  );

  const detectContactType = useCallback(
    (address: string, fallbackType: TempleContactApiType = 'user'): TempleContactApiType => {
      if (isKTAddress(address)) {
        return 'contract';
      }

      if (isKnownValidatorAddress(address)) {
        return 'validator';
      }

      return fallbackType;
    },
    [isKnownValidatorAddress]
  );

  const resolveContact = useCallback(
    (contact: Partial<TempleContact>, fallbackType?: TempleContactApiType) => {
      const address = contact.address?.trim() ?? '';
      const type = detectContactType(address, fallbackType);
      const resolvedContact: TempleContact = {
        address,
        name: contact.name?.trim() ?? '',
        ...(typeof contact.addedAt === 'number' ? { addedAt: contact.addedAt } : {})
      };

      return {
        contact: resolvedContact,
        type
      };
    },
    [detectContactType]
  );

  const prepareContactsForPersistence = useCallback(
    (contacts: TempleContact[], currentTypesByAddress?: Record<string, TempleContactApiType>) => {
      const normalizedContacts = normalizeContacts(
        contacts.map(contact => resolveContact(contact, currentTypesByAddress?.[contact.address.trim()]).contact)
      );
      const nextTypesByAddress = normalizedContacts.reduce<Record<string, TempleContactApiType>>((acc, contact) => {
        acc[contact.address] = detectContactType(contact.address, currentTypesByAddress?.[contact.address] ?? 'user');

        return acc;
      }, {});

      return {
        contacts: normalizedContacts,
        typesByAddress: Object.keys(nextTypesByAddress).length > 0 ? nextTypesByAddress : undefined
      };
    },
    [detectContactType, resolveContact]
  );

  const resolveContactsAccess = useCallback(
    async (interactive: boolean) => {
      if (!canUseEncryptedContacts(contactsBookScope) || !contactsStorageKey) {
        throw new Error(
          getContactsUnavailableMessage(
            contactsBookScope.status === 'unavailable' ? contactsBookScope.reason : 'missing-account'
          )
        );
      }

      const derivedContactsKey = await deriveContactsKey(account.publicKeyHash);

      if (derivedContactsKey.status !== 'available') {
        throw new Error(getContactsUnavailableMessage(derivedContactsKey.reason));
      }

      const contactsKey = {
        key: derivedContactsKey.key,
        bookAddr: derivedContactsKey.bookAddr
      };
      const legacyContactsKeys =
        derivedContactsKey.legacyKeys?.map(key => ({
          key,
          bookAddr: derivedContactsKey.bookAddr
        })) ?? [];
      const authContext = { walletAddress: derivedContactsKey.bookAddr, networkId: network.id };
      const resolvedContactsStorageKey = buildContactsStorageKey(derivedContactsKey.bookAddr, network.id);
      const shouldReadLegacyContacts = canReadLegacyContacts(settingsRef.current, resolvedContactsStorageKey);

      await ensureAuthorized(derivedContactsKey.bookAddr, network.id, interactive, derivedContactsKey.bookAddr);

      return {
        authContext,
        contactsKey,
        contactsStorageKey: resolvedContactsStorageKey,
        legacyContactsKeys: shouldReadLegacyContacts ? legacyContactsKeys : [],
        legacyAccountDataKey: shouldReadLegacyContacts
          ? getStoredContactsAccountDataKey(settingsRef.current, resolvedContactsStorageKey)
          : null,
        legacyPublicKey: shouldReadLegacyContacts ? await revealPublicKey(derivedContactsKey.bookAddr) : null
      };
    },
    [
      account.publicKeyHash,
      contactsBookScope,
      contactsStorageKey,
      deriveContactsKey,
      ensureAuthorized,
      network.id,
      revealPublicKey
    ]
  );

  const loadCurrentContactsState = useCallback(async () => {
    const currentSettings = settingsRef.current;
    const cachedState = contactsStorageKey ? getCachedContactsState(currentSettings, contactsStorageKey) : null;

    if (cachedState?.syncError) {
      throw new Error(getContactsUnavailableMessage(cachedState.syncError));
    }

    if (hasContactsServerBinding(cachedState)) {
      return cachedState;
    }

    const { authContext, contactsKey, legacyContactsKeys, legacyAccountDataKey, legacyPublicKey } =
      await resolveContactsAccess(true);
    const remoteState = await fetchContactsRecord({
      contactsKey,
      legacyContactsKeys,
      legacyAccountDataKey,
      legacyPublicKey,
      authContext
    }).catch(error => {
      if (error instanceof CurrentContactsRecordDecryptionError) {
        throw new Error(getContactsUnavailableMessage('decrypt-failed'));
      }

      throw error;
    });
    const syncedState =
      remoteState.shouldReencrypt && remoteState.recordId
        ? await saveContactsRecord({
            contactsKey,
            contacts: remoteState.contacts,
            recordId: remoteState.recordId,
            typesByAddress: remoteState.typesByAddress,
            authContext
          })
        : remoteState;

    return cachedState ? mergeCachedAndRemoteContactsState(cachedState, syncedState) : syncedState;
  }, [contactsStorageKey, resolveContactsAccess]);

  const persistContacts = useCallback(
    async (
      nextContacts: TempleContact[],
      recordId?: string | null,
      typesByAddress?: Record<string, TempleContactApiType>
    ) => {
      const {
        authContext,
        contactsKey,
        contactsStorageKey: resolvedContactsStorageKey
      } = await resolveContactsAccess(true);

      const currentRecordId =
        recordId === undefined ? getStoredContactsRecordId(settingsRef.current, resolvedContactsStorageKey) : recordId;
      const currentTypesByAddress =
        typesByAddress === undefined
          ? getStoredContactsTypesByAddress(settingsRef.current, resolvedContactsStorageKey)
          : typesByAddress;
      const { contacts: normalizedContacts, typesByAddress: resolvedTypesByAddress } = prepareContactsForPersistence(
        nextContacts,
        currentTypesByAddress
      );
      let nextRecordId = currentRecordId;
      let nextTypesByAddress = resolvedTypesByAddress;
      let nextLastSeenVersion: string | undefined;

      if (normalizedContacts.length > 0 || currentRecordId) {
        const saved = await saveContactsRecord({
          contactsKey,
          contacts: normalizedContacts,
          recordId: currentRecordId,
          typesByAddress: resolvedTypesByAddress,
          authContext
        });

        nextRecordId = saved.recordId;
        nextTypesByAddress = saved.typesByAddress;
        nextLastSeenVersion =
          saved.encryptionVersion === CONTACTS_ENCRYPTION_VERSION ? saved.encryptionVersion : undefined;
      } else {
        nextRecordId = null;
        nextTypesByAddress = undefined;
      }

      await updateSettings(
        buildContactsSettingsPatch(
          settingsRef.current,
          resolvedContactsStorageKey,
          normalizedContacts,
          nextRecordId,
          nextTypesByAddress,
          undefined,
          nextLastSeenVersion
        )
      );
    },
    [prepareContactsForPersistence, resolveContactsAccess, updateSettings]
  );

  const mutateContacts = useCallback(
    async (mutator: (sourceContacts: TempleContact[]) => TempleContact[]) => {
      const { contacts: sourceContacts, recordId, typesByAddress } = await loadCurrentContactsState();
      await persistContacts(mutator(sourceContacts), recordId, typesByAddress);
    },
    [loadCurrentContactsState, persistContacts]
  );

  const addContact = useCallback(
    async (cToAdd: TempleContact) => {
      const { contact } = resolveContact(cToAdd);

      if (allContacts.some(c => c.address === contact.address && c.accountInWallet)) {
        throw new Error(getMessage('contactWithTheSameAddressAlreadyExists'));
      }

      await mutateContacts(sourceContacts => {
        if (sourceContacts.some(c => c.address === contact.address)) {
          throw new Error(getMessage('contactWithTheSameAddressAlreadyExists'));
        }

        return [contact, ...sourceContacts];
      });
    },
    [allContacts, mutateContacts, resolveContact]
  );

  const addMultipleContacts = useCallback(
    async (rawContacts: Partial<TempleContact>[]) => {
      const normalized: TempleContact[] = rawContacts.map((c, i) => {
        const { contact } = resolveContact(c);
        const { name, address } = contact;

        // Required fields
        if (!name || !address) {
          throw new Error(`Contact #${i + 1}: name or address is missing`);
        }

        // Validate name
        if (!ACCOUNT_NAME_PATTERN.test(name)) {
          throw new Error(`Contact "${name}": invalid name format`);
        }

        // Validate address
        if (!isAddressValid(address)) {
          throw new Error(`Contact "${name}": invalid address`);
        }

        return {
          name,
          address,
          addedAt: Date.now()
        };
      });

      await mutateContacts(sourceContacts => {
        const existing = new Set(
          allContacts
            .filter(contact => contact.accountInWallet)
            .map(contact => contact.address)
            .concat(sourceContacts.map(contact => contact.address))
        );

        const unique = normalized.filter(contact => {
          if (existing.has(contact.address)) return false;
          existing.add(contact.address);
          return true;
        });

        if (!unique.length) {
          throw new Error(getMessage('noNewContactsToAdd'));
        }

        return [...unique, ...sourceContacts];
      });
    },
    [allContacts, mutateContacts, resolveContact]
  );

  const removeContact = useCallback(
    (address: string) => mutateContacts(sourceContacts => sourceContacts.filter(c => c.address !== address)),
    [mutateContacts]
  );

  const getContact = useCallback(
    (address: string) => allContacts.find(c => c.address === address) ?? null,
    [allContacts]
  );

  const editContact = useCallback(
    (address: string, updatedFields: Partial<TempleContact>) =>
      mutateContacts(sourceContacts =>
        sourceContacts.map(c => {
          if (c.address === address) {
            return {
              ...c,
              ...updatedFields
            };
          }

          return c;
        })
      ),
    [mutateContacts]
  );

  return {
    addContact,
    addMultipleContacts,
    removeContact,
    getContact,
    editContact
  };
}

const CONTACT_FIELDS_TO_SEARCH = ['name', 'address'] as const;

export function searchContacts<T extends TempleContact>(contacts: T[], searchValue: string) {
  if (!searchValue) return contacts;

  const loweredSearchValue = searchValue.toLowerCase();
  return contacts.filter(c =>
    CONTACT_FIELDS_TO_SEARCH.some(field => c[field].toLowerCase().includes(loweredSearchValue))
  );
}
