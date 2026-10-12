import { MavrykWalletDAppErrorType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';

import { CONTACTS_ENCRYPTION_VERSION, type ContactsCurrentKey } from 'lib/temple/contacts-crypto';
import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  canReadLegacyContacts,
  getCachedContactsState,
  getStoredContactsAccountDataKey,
  normalizeContacts
} from 'lib/temple/front/contacts-settings';
import { isAddressValid } from 'lib/temple/helpers';
import { normalizeNetworkId } from 'lib/temple/network-storage';
import {
  ContactsUnavailableReason,
  TempleContact,
  TempleContactApiType,
  TempleDAppSession,
  TempleSettings
} from 'lib/temple/types';
import {
  CurrentContactsRecordDecryptionError,
  fetchContactsRecord,
  getAuthTokensFromStorage,
  saveContactsRecord,
  type ResolvedMavrykAuthStorageContext
} from 'mavryk/api';

import { isTrustedNexusOrigin } from './trusted-origin.helpers';
import type { Vault } from './vault';

export enum DAppContactsMessageType {
  CapabilityRequest = 'CONTACTS_CAPABILITY_REQUEST',
  CapabilityResponse = 'CONTACTS_CAPABILITY_RESPONSE',
  GetRequest = 'CONTACTS_GET_REQUEST',
  GetResponse = 'CONTACTS_GET_RESPONSE',
  UpsertRequest = 'CONTACTS_UPSERT_REQUEST',
  UpsertResponse = 'CONTACTS_UPSERT_RESPONSE',
  DeleteRequest = 'CONTACTS_DELETE_REQUEST',
  DeleteResponse = 'CONTACTS_DELETE_RESPONSE',
  ReplaceRequest = 'CONTACTS_REPLACE_REQUEST',
  ReplaceResponse = 'CONTACTS_REPLACE_RESPONSE'
}

export type DAppContactsRequest =
  | {
      type: DAppContactsMessageType.CapabilityRequest;
    }
  | DAppContactsGetRequest
  | DAppContactsMutationRequest;

type DAppContactsGetRequest = {
  type: DAppContactsMessageType.GetRequest;
  accountPublicKeyHash: string;
  networkId: string;
};

type DAppContactsMutationRequest = {
  type:
    | DAppContactsMessageType.UpsertRequest
    | DAppContactsMessageType.DeleteRequest
    | DAppContactsMessageType.ReplaceRequest;
  accountPublicKeyHash: string;
  networkId: string;
  contacts?: unknown;
  addresses?: unknown;
};

export type DAppContactsResponse =
  | {
      type: DAppContactsMessageType.CapabilityResponse;
      protocolVersion: 1;
      supported: true;
      operations: Array<'get' | 'upsert' | 'delete' | 'replace'>;
    }
  | ({
      type:
        | DAppContactsMessageType.GetResponse
        | DAppContactsMessageType.UpsertResponse
        | DAppContactsMessageType.DeleteResponse
        | DAppContactsMessageType.ReplaceResponse;
    } & DAppContactsState);

type DAppContactsState =
  | {
      status: 'available';
      bookAddr: string;
      contacts: TempleContact[];
      encryptionVersion?: string;
      networkId: string;
      recordId: string | null;
      typesByAddress?: Record<string, TempleContactApiType>;
    }
  | {
      status: 'unavailable';
      bookAddr?: string;
      contacts: [];
      networkId?: string;
      reason: ContactsUnavailableReason;
    };

type ContactsDAppDeps = {
  dApp: TempleDAppSession | undefined;
  ensureAuthorized: (
    accountPublicKeyHash: string,
    networkId: string,
    explicitAuthWalletAddress: string
  ) => Promise<void>;
  updateSettings: (settings: Partial<TempleSettings>) => Promise<void>;
  vault: Vault;
};

type ContactsAccess = {
  authContext: ResolvedMavrykAuthStorageContext;
  bookAddr: string;
  contactsKey: ContactsCurrentKey;
  contactsStorageKey: string;
  legacyAccountDataKey: string | null;
  legacyContactsKeys: ContactsCurrentKey[];
  legacyPublicKey?: string;
  networkId: string;
};

type ContactsRecordState = Awaited<ReturnType<typeof fetchContactsRecord>>;
type ContactsSaveState = Awaited<ReturnType<typeof saveContactsRecord>>;
type ContactsPersistableState = {
  contacts: TempleContact[];
  encryptionVersion?: string;
  recordId: string | null;
  typesByAddress?: Record<string, TempleContactApiType>;
};
type DAppContactsOperationResponse = Exclude<
  DAppContactsResponse,
  { type: DAppContactsMessageType.CapabilityResponse }
>;
type DAppContactsOperationResponseType = DAppContactsOperationResponse['type'];
type AvailableDAppContactsOperationResponse = Extract<DAppContactsOperationResponse, { status: 'available' }>;
type ContactsMutationInput = {
  contacts: TempleContact[];
  typesByAddress: Record<string, TempleContactApiType>;
};

const CONTACTS_REQUEST_TYPES = new Set<string>([
  DAppContactsMessageType.CapabilityRequest,
  DAppContactsMessageType.GetRequest,
  DAppContactsMessageType.UpsertRequest,
  DAppContactsMessageType.DeleteRequest,
  DAppContactsMessageType.ReplaceRequest
]);
const CONTACTS_API_TYPES = new Set<TempleContactApiType>(['user', 'validator', 'contract']);

export function isDAppContactsRequest(req: unknown): req is DAppContactsRequest {
  return Boolean(
    req && typeof req === 'object' && CONTACTS_REQUEST_TYPES.has(String((req as { type?: unknown }).type ?? ''))
  );
}

export async function processDAppContactsRequest(
  origin: string,
  req: DAppContactsRequest,
  deps: ContactsDAppDeps
): Promise<DAppContactsResponse> {
  if (!isTrustedNexusOrigin(origin)) {
    throw new Error(MavrykWalletDAppErrorType.NotGranted);
  }

  if (req.type === DAppContactsMessageType.CapabilityRequest) {
    return {
      type: DAppContactsMessageType.CapabilityResponse,
      protocolVersion: 1,
      supported: true,
      operations: ['get', 'upsert', 'delete', 'replace']
    };
  }

  if (!deps.dApp) {
    throw new Error(MavrykWalletDAppErrorType.NotGranted);
  }

  const networkId = resolveRequestNetworkId(req.networkId, deps.dApp);

  if (req.accountPublicKeyHash !== deps.dApp.pkh) {
    throw new Error(MavrykWalletDAppErrorType.NotFound);
  }

  const derivedContactsKey = await deps.vault.deriveContactsKey(req.accountPublicKeyHash);

  if (derivedContactsKey.status !== 'available') {
    return buildUnavailableContactsResponse(getContactsResponseType(req.type), derivedContactsKey.reason, {
      bookAddr: derivedContactsKey.bookAddr,
      networkId
    });
  }

  let contactsAccess: ContactsAccess;

  try {
    contactsAccess = await resolveContactsAccess(req.accountPublicKeyHash, networkId, derivedContactsKey, deps);
  } catch (error) {
    if (error instanceof ContactsBridgeUnavailableError) {
      return buildUnavailableContactsResponse(getContactsResponseType(req.type), error.reason, {
        bookAddr: error.bookAddr,
        networkId: error.networkId
      });
    }

    throw error;
  }

  const currentState = await loadContactsState(contactsAccess, deps, getContactsResponseType(req.type));

  if (currentState.status === 'unavailable') {
    return currentState;
  }

  switch (req.type) {
    case DAppContactsMessageType.GetRequest:
      return currentState;

    case DAppContactsMessageType.UpsertRequest:
      return persistContactsState(
        contactsAccess,
        deps,
        getContactsResponseType(req.type),
        buildUpsertContactsState(currentState, parseContactsMutationInput(req.contacts))
      );

    case DAppContactsMessageType.DeleteRequest:
      return persistContactsState(
        contactsAccess,
        deps,
        getContactsResponseType(req.type),
        buildDeleteContactsState(currentState, parseContactAddresses(req.addresses))
      );

    case DAppContactsMessageType.ReplaceRequest:
      return persistContactsState(
        contactsAccess,
        deps,
        getContactsResponseType(req.type),
        buildReplaceContactsState(currentState, parseContactsMutationInput(req.contacts))
      );
  }
}

async function resolveContactsAccess(
  accountPublicKeyHash: string,
  networkId: string,
  derivedContactsKey: Extract<Awaited<ReturnType<Vault['deriveContactsKey']>>, { status: 'available' }>,
  deps: ContactsDAppDeps
): Promise<ContactsAccess> {
  const contactsKey = {
    key: derivedContactsKey.key,
    bookAddr: derivedContactsKey.bookAddr
  };
  const contactsStorageKey = buildContactsStorageKey(derivedContactsKey.bookAddr, networkId);
  const settings = await deps.vault.fetchSettings();
  const shouldReadLegacyContacts = canReadLegacyContacts(settings, contactsStorageKey);
  const authContext = {
    walletAddress: derivedContactsKey.bookAddr,
    networkId
  };

  await deps.ensureAuthorized(accountPublicKeyHash, networkId, derivedContactsKey.bookAddr);

  const { accessToken } = await getAuthTokensFromStorage(authContext);

  if (!accessToken) {
    await updateContactsSyncError(contactsStorageKey, 'auth-unavailable', deps);
    throw new ContactsBridgeUnavailableError('auth-unavailable', derivedContactsKey.bookAddr, networkId);
  }

  return {
    authContext,
    bookAddr: derivedContactsKey.bookAddr,
    contactsKey,
    contactsStorageKey,
    legacyContactsKeys: shouldReadLegacyContacts
      ? derivedContactsKey.legacyKeys?.map(key => ({ key, bookAddr: derivedContactsKey.bookAddr })) ?? []
      : [],
    legacyAccountDataKey: shouldReadLegacyContacts
      ? getStoredContactsAccountDataKey(settings, contactsStorageKey)
      : null,
    legacyPublicKey: shouldReadLegacyContacts
      ? await deps.vault.revealPublicKey(derivedContactsKey.bookAddr)
      : undefined,
    networkId
  };
}

async function loadContactsState(
  contactsAccess: ContactsAccess,
  deps: ContactsDAppDeps,
  responseType: DAppContactsOperationResponseType
): Promise<DAppContactsOperationResponse> {
  try {
    const remoteState = await fetchContactsRecord({
      contactsKey: contactsAccess.contactsKey,
      legacyContactsKeys: contactsAccess.legacyContactsKeys,
      legacyAccountDataKey: contactsAccess.legacyAccountDataKey,
      legacyPublicKey: contactsAccess.legacyPublicKey,
      authContext: contactsAccess.authContext
    });
    const syncedState =
      remoteState.shouldReencrypt && remoteState.recordId
        ? await saveContactsRecord({
            contactsKey: contactsAccess.contactsKey,
            contacts: remoteState.contacts,
            recordId: remoteState.recordId,
            typesByAddress: remoteState.typesByAddress,
            authContext: contactsAccess.authContext
          })
        : remoteState;

    await updateContactsSettings(contactsAccess.contactsStorageKey, syncedState, deps);

    return buildAvailableContactsResponse(responseType, contactsAccess, syncedState);
  } catch (error) {
    if (error instanceof ContactsBridgeUnavailableError) {
      return buildUnavailableContactsResponse(responseType, error.reason, {
        bookAddr: error.bookAddr,
        networkId: error.networkId
      });
    }

    if (error instanceof CurrentContactsRecordDecryptionError) {
      await updateContactsSyncError(contactsAccess.contactsStorageKey, 'decrypt-failed', deps);

      return buildUnavailableContactsResponse(responseType, 'decrypt-failed', contactsAccess);
    }

    throw error;
  }
}

async function persistContactsState(
  contactsAccess: ContactsAccess,
  deps: ContactsDAppDeps,
  responseType: DAppContactsOperationResponseType,
  nextState: ContactsPersistableState
) {
  if (nextState.contacts.length === 0 && !nextState.recordId) {
    await updateContactsSettings(contactsAccess.contactsStorageKey, nextState, deps);

    return buildAvailableContactsResponse(responseType, contactsAccess, nextState);
  }

  try {
    const savedState = await saveContactsRecord({
      contactsKey: contactsAccess.contactsKey,
      contacts: nextState.contacts,
      recordId: nextState.recordId,
      typesByAddress: nextState.typesByAddress,
      authContext: contactsAccess.authContext
    });

    await updateContactsSettings(contactsAccess.contactsStorageKey, savedState, deps);

    return buildAvailableContactsResponse(responseType, contactsAccess, savedState);
  } catch (error) {
    if (error instanceof CurrentContactsRecordDecryptionError) {
      await updateContactsSyncError(contactsAccess.contactsStorageKey, 'decrypt-failed', deps);

      return buildUnavailableContactsResponse(responseType, 'decrypt-failed', contactsAccess);
    }

    throw error;
  }
}

function resolveRequestNetworkId(networkId: unknown, dApp: TempleDAppSession) {
  if (typeof networkId !== 'string' || !networkId.trim()) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const normalizedNetworkId = normalizeNetworkId(networkId.trim());
  const dAppNetworkId = getDAppNetworkId(dApp);

  if (dAppNetworkId && normalizedNetworkId !== dAppNetworkId) {
    throw new Error(MavrykWalletDAppErrorType.NotFound);
  }

  return normalizedNetworkId;
}

function getDAppNetworkId(dApp: TempleDAppSession) {
  return typeof dApp.network === 'string' ? normalizeNetworkId(dApp.network) : null;
}

function getContactsResponseType(
  requestType: Exclude<DAppContactsRequest['type'], DAppContactsMessageType.CapabilityRequest>
) {
  switch (requestType) {
    case DAppContactsMessageType.GetRequest:
      return DAppContactsMessageType.GetResponse;

    case DAppContactsMessageType.UpsertRequest:
      return DAppContactsMessageType.UpsertResponse;

    case DAppContactsMessageType.DeleteRequest:
      return DAppContactsMessageType.DeleteResponse;

    case DAppContactsMessageType.ReplaceRequest:
      return DAppContactsMessageType.ReplaceResponse;
  }
}

function parseContactsMutationInput(contacts: unknown): ContactsMutationInput {
  if (!Array.isArray(contacts)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  return contacts.reduce<ContactsMutationInput>(
    (acc, contact) => {
      const normalizedContact = normalizeContactInput(contact);
      acc.contacts.push(normalizedContact.contact);
      acc.typesByAddress[normalizedContact.contact.address] = normalizedContact.type;

      return acc;
    },
    { contacts: [], typesByAddress: {} }
  );
}

function normalizeContactInput(contact: unknown) {
  if (!contact || typeof contact !== 'object') {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const { name, address, addedAt, type } = contact as Record<string, unknown>;

  if (typeof name !== 'string' || typeof address !== 'string') {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const resolvedAddress = address.trim();
  const resolvedName = name.trim();

  if (!resolvedName || !isAddressValid(resolvedAddress)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  return {
    contact: {
      name: resolvedName,
      address: resolvedAddress,
      ...(typeof addedAt === 'number' ? { addedAt } : {})
    },
    type: isContactApiType(type) ? type : 'user'
  };
}

function parseContactAddresses(addresses: unknown) {
  if (!Array.isArray(addresses)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  return addresses.map(address => {
    if (typeof address !== 'string' || !isAddressValid(address.trim())) {
      throw new Error(MavrykWalletDAppErrorType.InvalidParams);
    }

    return address.trim();
  });
}

function buildUpsertContactsState(currentState: AvailableDAppContactsOperationResponse, input: ContactsMutationInput) {
  const nextContactsByAddress = new Map(currentState.contacts.map(contact => [contact.address, contact]));
  const nextTypesByAddress = { ...(currentState.typesByAddress ?? {}) };

  input.contacts.forEach(contact => {
    nextContactsByAddress.set(contact.address, contact);
    nextTypesByAddress[contact.address] = input.typesByAddress[contact.address];
  });

  const contacts = normalizeContacts(Array.from(nextContactsByAddress.values()));

  return {
    contacts,
    recordId: currentState.recordId,
    typesByAddress: filterTypesByContacts(contacts, nextTypesByAddress)
  };
}

function buildDeleteContactsState(currentState: AvailableDAppContactsOperationResponse, addresses: string[]) {
  const addressesToDelete = new Set(addresses);
  const contacts = currentState.contacts.filter(contact => !addressesToDelete.has(contact.address));

  return {
    contacts,
    recordId: currentState.recordId,
    typesByAddress: filterTypesByContacts(contacts, currentState.typesByAddress)
  };
}

function buildReplaceContactsState(currentState: AvailableDAppContactsOperationResponse, input: ContactsMutationInput) {
  const contacts = normalizeContacts(input.contacts);

  return {
    contacts,
    recordId: currentState.recordId,
    typesByAddress: filterTypesByContacts(contacts, input.typesByAddress)
  };
}

function buildAvailableContactsResponse(
  type: DAppContactsOperationResponseType,
  contactsAccess: ContactsAccess,
  state: ContactsRecordState | ContactsSaveState | ContactsPersistableState
): DAppContactsOperationResponse {
  const typesByAddress = filterTypesByContacts(state.contacts, state.typesByAddress);

  return {
    type,
    status: 'available',
    bookAddr: contactsAccess.bookAddr,
    contacts: applyTypesToContacts(state.contacts, typesByAddress),
    ...(state.encryptionVersion ? { encryptionVersion: state.encryptionVersion } : {}),
    networkId: contactsAccess.networkId,
    recordId: state.recordId,
    ...(Object.keys(typesByAddress).length > 0 ? { typesByAddress } : {})
  };
}

function buildUnavailableContactsResponse(
  type: DAppContactsOperationResponseType,
  reason: ContactsUnavailableReason,
  context: { bookAddr?: string; networkId?: string }
): DAppContactsOperationResponse {
  return {
    type,
    status: 'unavailable',
    ...(context.bookAddr ? { bookAddr: context.bookAddr } : {}),
    contacts: [],
    ...(context.networkId ? { networkId: context.networkId } : {}),
    reason
  };
}

async function updateContactsSettings(
  contactsStorageKey: string,
  state: {
    contacts: TempleContact[];
    encryptionVersion?: string;
    recordId: string | null;
    typesByAddress?: Record<string, TempleContactApiType>;
  },
  deps: ContactsDAppDeps
) {
  const settings = await deps.vault.fetchSettings();

  await deps.updateSettings(
    buildContactsSettingsPatch(
      settings,
      contactsStorageKey,
      state.contacts,
      state.recordId,
      state.typesByAddress,
      undefined,
      state.encryptionVersion === CONTACTS_ENCRYPTION_VERSION ? state.encryptionVersion : undefined
    )
  );
}

async function updateContactsSyncError(
  contactsStorageKey: string,
  syncError: Extract<ContactsUnavailableReason, 'auth-unavailable' | 'decrypt-failed'>,
  deps: ContactsDAppDeps
) {
  const settings = await deps.vault.fetchSettings();
  const cachedState = getCachedContactsState(settings, contactsStorageKey);

  await deps.updateSettings(
    buildContactsSettingsPatch(
      settings,
      contactsStorageKey,
      cachedState?.contacts ?? [],
      cachedState?.recordId ?? null,
      cachedState?.typesByAddress,
      syncError
    )
  );
}

function applyTypesToContacts(
  contacts: TempleContact[],
  typesByAddress: Record<string, TempleContactApiType>
): TempleContact[] {
  return contacts.map(contact => ({
    ...contact,
    type: typesByAddress[contact.address] ?? 'user'
  }));
}

function filterTypesByContacts(contacts: TempleContact[], typesByAddress?: Record<string, TempleContactApiType>) {
  const contactAddresses = new Set(contacts.map(contact => contact.address));

  return Object.entries(typesByAddress ?? {}).reduce<Record<string, TempleContactApiType>>((acc, [address, type]) => {
    if (contactAddresses.has(address)) {
      acc[address] = type;
    }

    return acc;
  }, {});
}

function isContactApiType(value: unknown): value is TempleContactApiType {
  return CONTACTS_API_TYPES.has(value as TempleContactApiType);
}

class ContactsBridgeUnavailableError extends Error {
  constructor(
    public readonly reason: Extract<ContactsUnavailableReason, 'auth-unavailable'>,
    public readonly bookAddr: string,
    public readonly networkId: string
  ) {
    super(reason);
    this.name = 'ContactsBridgeUnavailableError';
    Object.setPrototypeOf(this, ContactsBridgeUnavailableError.prototype);
  }
}
