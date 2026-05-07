import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import { getMessage } from 'lib/i18n';
import { TempleContact, TempleContactApiType } from 'lib/temple/types';
import { fetchContactsRecord, saveContactsRecord } from 'mavryk/api/contacts';

import { isAddressValid, isKTAddress } from '../helpers';

import { useKnownBakers } from './baking/baking';
import { PREDEFINED_BAKERS_NAMES_MAINNET } from './baking/const';
import { useTempleClient } from './client';
import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  canUseEncryptedContacts,
  getCachedContactsState,
  getContactsOwnerAddress,
  getStoredContactsRecordId,
  getStoredContactsTypesByAddress,
  normalizeContacts
} from './contacts-settings';
import { useAccount, useAllAccounts, useNetwork, useSettings } from './ready';
import { useFilteredContacts } from './use-filtered-contacts.hook';

function isPredefinedValidatorAddress(address: string) {
  return PREDEFINED_BAKERS_NAMES_MAINNET[address] !== undefined;
}

export function useContactsActions() {
  const { ensureAuthorized, revealPublicKey, updateSettings } = useTempleClient();
  const account = useAccount();
  const allAccounts = useAllAccounts();
  const network = useNetwork();
  const knownBakers = useKnownBakers(false);
  const settings = useSettings();
  const { allContacts } = useFilteredContacts();
  const settingsRef = useRef(settings);
  const contactsOwnerAddress = getContactsOwnerAddress(allAccounts, account.publicKeyHash);
  const contactsStorageKey = contactsOwnerAddress ? buildContactsStorageKey(contactsOwnerAddress, network.id) : null;
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

  const loadCurrentContactsState = useCallback(async () => {
    const currentSettings = settingsRef.current;
    const cachedState = contactsStorageKey ? getCachedContactsState(currentSettings, contactsStorageKey) : null;

    if (cachedState) {
      return cachedState;
    }

    if (!canUseEncryptedContacts(contactsOwnerAddress) || !contactsStorageKey) {
      throw new Error('Encrypted contacts are unavailable for this account');
    }

    await ensureAuthorized(contactsOwnerAddress, network.id);
    const publicKey = await revealPublicKey(contactsOwnerAddress);
    return fetchContactsRecord(publicKey);
  }, [contactsOwnerAddress, contactsStorageKey, ensureAuthorized, network.id, revealPublicKey]);

  const persistContacts = useCallback(
    async (
      nextContacts: TempleContact[],
      recordId?: string | null,
      typesByAddress?: Record<string, TempleContactApiType>
    ) => {
      if (!canUseEncryptedContacts(contactsOwnerAddress) || !contactsStorageKey) {
        throw new Error('Encrypted contacts are unavailable for this account');
      }

      const currentRecordId =
        recordId === undefined ? getStoredContactsRecordId(settingsRef.current, contactsStorageKey) : recordId;
      const currentTypesByAddress =
        typesByAddress === undefined
          ? getStoredContactsTypesByAddress(settingsRef.current, contactsStorageKey)
          : typesByAddress;
      const { contacts: normalizedContacts, typesByAddress: resolvedTypesByAddress } = prepareContactsForPersistence(
        nextContacts,
        currentTypesByAddress
      );
      let nextRecordId = currentRecordId;
      let nextTypesByAddress = resolvedTypesByAddress;

      if (normalizedContacts.length > 0 || currentRecordId) {
        await ensureAuthorized(contactsOwnerAddress, network.id);
        const publicKey = await revealPublicKey(contactsOwnerAddress);
        const saved = await saveContactsRecord({
          contacts: normalizedContacts,
          publicKey,
          recordId: currentRecordId,
          typesByAddress: resolvedTypesByAddress
        });

        nextRecordId = saved.recordId;
        nextTypesByAddress = saved.typesByAddress;
      } else {
        nextRecordId = null;
        nextTypesByAddress = undefined;
      }

      await updateSettings(
        buildContactsSettingsPatch(
          settingsRef.current,
          contactsStorageKey,
          normalizedContacts,
          nextRecordId,
          nextTypesByAddress
        )
      );
    },
    [
      contactsOwnerAddress,
      contactsStorageKey,
      ensureAuthorized,
      network.id,
      prepareContactsForPersistence,
      revealPublicKey,
      updateSettings
    ]
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
