import { MavrykWalletDAppErrorType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';

import type { TempleDAppSession } from 'lib/temple/types';
import { fetchContactsRecord, getAuthTokensFromStorage } from 'mavryk/api';

import { DAppContactsMessageType, isDAppContactsRequest, processDAppContactsRequest } from './dapp-contacts';
import type { Vault } from './vault';

jest.mock('@vespaiach/axios-fetch-adapter', () => jest.fn());

jest.mock('mavryk/api', () => ({
  CurrentContactsRecordDecryptionError: class CurrentContactsRecordDecryptionError extends Error {},
  fetchContactsRecord: jest.fn(),
  getAuthTokensFromStorage: jest.fn(),
  MAVRYK_API_URLS: jest.requireActual('mavryk/api/client').MAVRYK_API_URLS,
  saveContactsRecord: jest.fn()
}));

const NEXUS_ORIGIN = 'https://nexus.mavryk.org';
const SESSION_PKH = 'mv1-session';

const buildSession = (network: TempleDAppSession['network']): TempleDAppSession => ({
  network,
  appMeta: { name: 'Nexus' },
  pkh: SESSION_PKH,
  publicKey: 'edpk-session'
});

const buildDeps = (dApp: TempleDAppSession) => {
  const vault = {
    deriveContactsKey: jest.fn().mockResolvedValue({ status: 'available', key: 'contacts-key', bookAddr: SESSION_PKH }),
    fetchSettings: jest.fn().mockResolvedValue({}),
    revealPublicKey: jest.fn().mockResolvedValue('edpk-session')
  };

  return {
    dApp,
    ensureAuthorized: jest.fn().mockResolvedValue(undefined),
    updateSettings: jest.fn().mockResolvedValue(undefined),
    vault: vault as unknown as Vault
  };
};

const buildGetRequest = (networkId: string) => ({
  type: DAppContactsMessageType.GetRequest as const,
  accountPublicKeyHash: SESSION_PKH,
  networkId
});

describe('isDAppContactsRequest', () => {
  it.each([
    DAppContactsMessageType.CapabilityRequest,
    DAppContactsMessageType.GetRequest,
    DAppContactsMessageType.UpsertRequest,
    DAppContactsMessageType.DeleteRequest,
    DAppContactsMessageType.ReplaceRequest
  ])('accepts contacts bridge request type %s', type => {
    expect(isDAppContactsRequest({ type })).toBe(true);
  });

  it.each([null, undefined, 'CONTACTS_GET_REQUEST', { type: 'GET_CURRENT_PERMISSION_REQUEST' }])(
    'rejects non-contacts request %p',
    request => {
      expect(isDAppContactsRequest(request)).toBe(false);
    }
  );
});

describe('processDAppContactsRequest network scope binding', () => {
  beforeEach(() => {
    (getAuthTokensFromStorage as jest.Mock).mockResolvedValue({ accessToken: 'access-token', refreshToken: null });
    (fetchContactsRecord as jest.Mock).mockResolvedValue({ contacts: [], recordId: null });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a mainnet request from a session approved for a custom RPC network', async () => {
    const deps = buildDeps(buildSession({ name: 'dev', rpc: 'https://x' }));

    await expect(processDAppContactsRequest(NEXUS_ORIGIN, buildGetRequest('mainnet'), deps)).rejects.toThrow(
      MavrykWalletDAppErrorType.NotFound
    );
    expect(deps.ensureAuthorized).not.toHaveBeenCalled();
    expect(fetchContactsRecord).not.toHaveBeenCalled();
  });

  it('rejects a request for a network other than the session network', async () => {
    const deps = buildDeps(buildSession('mainnet'));

    await expect(processDAppContactsRequest(NEXUS_ORIGIN, buildGetRequest('basenet'), deps)).rejects.toThrow(
      MavrykWalletDAppErrorType.NotFound
    );
    expect(deps.ensureAuthorized).not.toHaveBeenCalled();
  });

  it('rejects a sandbox session because it has no API scope of its own', async () => {
    const deps = buildDeps(buildSession('sandbox'));

    await expect(processDAppContactsRequest(NEXUS_ORIGIN, buildGetRequest('sandbox'), deps)).rejects.toThrow(
      MavrykWalletDAppErrorType.NotFound
    );
    expect(deps.ensureAuthorized).not.toHaveBeenCalled();
  });

  it.each(['foo]bar', 'mainnet][refresh', 'unknown', 'constructor', '__proto__'])(
    'rejects unknown network id %p',
    async networkId => {
      const deps = buildDeps(buildSession({ name: 'dev', rpc: 'https://x' }));

      await expect(processDAppContactsRequest(NEXUS_ORIGIN, buildGetRequest(networkId), deps)).rejects.toThrow(
        MavrykWalletDAppErrorType.NotFound
      );
      expect(deps.ensureAuthorized).not.toHaveBeenCalled();
    }
  );

  it.each(['foo]bar', 'unknown'])('rejects unknown network id %p for a string-network session', async networkId => {
    const deps = buildDeps(buildSession(networkId as TempleDAppSession['network']));

    await expect(processDAppContactsRequest(NEXUS_ORIGIN, buildGetRequest(networkId), deps)).rejects.toThrow(
      MavrykWalletDAppErrorType.NotFound
    );
    expect(deps.ensureAuthorized).not.toHaveBeenCalled();
  });

  it('serves contacts for a request matching a mainnet session', async () => {
    const deps = buildDeps(buildSession('mainnet'));

    const response = await processDAppContactsRequest(NEXUS_ORIGIN, buildGetRequest('mainnet'), deps);

    expect(deps.ensureAuthorized).toHaveBeenCalledWith(SESSION_PKH, 'mainnet', SESSION_PKH);
    expect(response).toMatchObject({
      type: DAppContactsMessageType.GetResponse,
      status: 'available',
      networkId: 'mainnet'
    });
  });

  it('normalises a legacy atlasnet session and request to basenet', async () => {
    const deps = buildDeps(buildSession('atlasnet'));

    const response = await processDAppContactsRequest(NEXUS_ORIGIN, buildGetRequest('atlasnet'), deps);

    expect(deps.ensureAuthorized).toHaveBeenCalledWith(SESSION_PKH, 'basenet', SESSION_PKH);
    expect(response).toMatchObject({ status: 'available', networkId: 'basenet' });
  });
});
