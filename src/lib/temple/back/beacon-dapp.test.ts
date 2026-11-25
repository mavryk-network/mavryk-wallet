import bs58check from 'bs58check';
import { Buffer } from 'buffer';
import { crypto_generichash, crypto_sign_seed_keypair, from_string } from 'libsodium-wrappers';

import * as Beacon from 'lib/temple/beacon';

import { getBeaconMessage, processBeacon } from './beacon-dapp';

jest.mock(
  'mavryk/api',
  () => ({
    getAuthTokensFromStorage: jest.fn(),
    getSelectedNetworkIdFromStorage: jest.fn(),
    isJwtExpiringSoon: jest.fn(),
    logoutAuth: jest.fn(),
    refreshAuthTokens: jest.fn(),
    requestAuthChallenge: jest.fn(),
    verifyAuthSignature: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  'mavryk/api/storage',
  () => ({
    setAuthWalletAddressesMapToStorage: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  'mavryk/api/utils',
  () => ({
    signAuthChallengeWithVault: jest.fn()
  }),
  { virtual: true }
);

jest.mock('lib/temple/beacon', () => {
  // Load the module as a Firefox build would, where runtime.getURL embeds the per-install extension UUID
  const { runtime } = jest.requireActual('webextension-polyfill');
  const defaultGetURL = runtime.getURL;
  runtime.getURL = (path: string) => `moz-extension://11111111-2222-3333-4444-555555555555/${path}`;
  const actual = jest.requireActual('lib/temple/beacon');
  runtime.getURL = defaultGetURL;

  return {
    ...actual,
    sealCryptobox: jest.fn(actual.sealCryptobox),
    getDAppPublicKey: jest.fn(actual.getDAppPublicKey),
    decryptMessage: jest.fn(actual.decryptMessage),
    decodeMessage: jest.fn(actual.decodeMessage),
    removeDAppPublicKey: jest.fn()
  };
});

const mockedRemoveDAppPublicKey = Beacon.removeDAppPublicKey as jest.MockedFunction<typeof Beacon.removeDAppPublicKey>;
const mockedGetDAppPublicKey = Beacon.getDAppPublicKey as jest.MockedFunction<typeof Beacon.getDAppPublicKey>;
const mockedDecryptMessage = Beacon.decryptMessage as jest.MockedFunction<typeof Beacon.decryptMessage>;
const mockedDecodeMessage = Beacon.decodeMessage as jest.MockedFunction<typeof Beacon.decodeMessage>;
const mockedSealCryptobox = Beacon.sealCryptobox as jest.MockedFunction<typeof Beacon.sealCryptobox>;

describe('getBeaconMessage payload bound', () => {
  const origin = 'https://dapp.example';
  const maxPayloadLength = 64 * 1024;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDAppPublicKey.mockResolvedValue('dapp-public-key');
    mockedDecryptMessage.mockResolvedValue('decrypted');
    mockedDecodeMessage.mockReturnValue(null);
  });

  afterEach(() => {
    const actualBeacon = jest.requireActual('lib/temple/beacon');
    mockedGetDAppPublicKey.mockImplementation(actualBeacon.getDAppPublicKey);
    mockedDecryptMessage.mockImplementation(actualBeacon.decryptMessage);
    mockedDecodeMessage.mockImplementation(actualBeacon.decodeMessage);
  });

  it('rejects an oversized encrypted payload before key lookup, decryption or decoding', async () => {
    await expect(getBeaconMessage(origin, 'a'.repeat(maxPayloadLength + 1), true)).rejects.toThrow();

    expect(mockedGetDAppPublicKey).not.toHaveBeenCalled();
    expect(mockedDecryptMessage).not.toHaveBeenCalled();
    expect(mockedDecodeMessage).not.toHaveBeenCalled();
    expect(mockedRemoveDAppPublicKey).not.toHaveBeenCalled();
  });

  it('rejects an oversized plain payload before decoding', async () => {
    await expect(getBeaconMessage(origin, 'a'.repeat(maxPayloadLength + 1))).rejects.toThrow();

    expect(mockedDecodeMessage).not.toHaveBeenCalled();
  });

  it('rejects a non-string payload before decoding', async () => {
    await expect(getBeaconMessage(origin, { length: 1 } as unknown as string, true)).rejects.toThrow();

    expect(mockedDecryptMessage).not.toHaveBeenCalled();
    expect(mockedDecodeMessage).not.toHaveBeenCalled();
  });

  it('decrypts and decodes a payload at the size limit', async () => {
    const payload = 'a'.repeat(maxPayloadLength);

    await getBeaconMessage(origin, payload, true);

    expect(mockedDecryptMessage).toHaveBeenCalledWith(origin, payload, 'dapp-public-key');
    expect(mockedDecodeMessage).toHaveBeenCalledWith('decrypted');
  });
});

describe('processBeacon install identifiers', () => {
  const pagePublicKey = '444e1f4ab90c304a5ac003d367747aab63815f583ff2330ce159d12c1ecceba1';
  const originA = 'https://a.example';
  const originB = 'https://b.example';

  const handshake = async (origin: string) => {
    const res = await processBeacon(
      origin,
      Beacon.encodeMessage({
        type: Beacon.MessageType.HandshakeRequest,
        version: '2',
        id: 'handshake-1',
        name: 'Probe',
        publicKey: pagePublicKey
      })
    );
    return { raw: res?.payload ?? '', reply: JSON.parse(res?.payload ?? '{}') };
  };

  const plainReply = async (origin: string, msg: string, encrypted = false) => {
    const res = await processBeacon(origin, msg, encrypted);
    return Beacon.decodeMessage<{ type: Beacon.MessageType; senderId?: string }>(res?.payload ?? '');
  };

  // libsodium rejects the Node-realm bytes that the jest setup's TextEncoder returns under jsdom
  const setupEncode = TextEncoder.prototype.encode;
  let encodeSpy: jest.SpyInstance;

  beforeAll(() => {
    encodeSpy = jest
      .spyOn(TextEncoder.prototype, 'encode')
      .mockImplementation(function (this: TextEncoder, input?: string) {
        return new Uint8Array(setupEncode.call(this, input));
      });
  });

  afterAll(() => {
    encodeSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reply in plaintext so the test can read what the page would receive
    mockedSealCryptobox.mockImplementation(async payload => payload.toString());
  });

  afterEach(() => {
    mockedSealCryptobox.mockImplementation(jest.requireActual('lib/temple/beacon').sealCryptobox);
  });

  it('does not disclose an extension-internal URL to an https origin', async () => {
    const { raw, reply } = await handshake(originA);

    expect(mockedSealCryptobox).toHaveBeenCalledTimes(1);
    expect(reply).toEqual(
      expect.objectContaining({ type: Beacon.MessageType.HandshakeResponse, name: 'Mavryk Wallet' })
    );
    expect(reply).not.toHaveProperty('appUrl');
    ['moz-extension://', 'chrome-extension://', 'safari-web-extension://'].forEach(scheme =>
      expect(raw).not.toContain(scheme)
    );
  });

  it('gives each origin its own wallet public key and senderId, stable across handshakes', async () => {
    const { reply: replyA } = await handshake(originA);
    const { reply: replyB } = await handshake(originB);
    const { reply: replyAgain } = await handshake(originA);

    expect(replyA.publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(replyA.publicKey).not.toBe(replyB.publicKey);
    expect(replyA.senderId).not.toBe(replyB.senderId);
    expect(replyAgain.publicKey).toBe(replyA.publicKey);
    expect(replyAgain.senderId).toBe(replyA.senderId);
  });

  it('does not reveal a cross-origin senderId in the Disconnect reply to an unpaired encrypted message', async () => {
    const stubA = await plainReply(originA, 'unpaired', true);
    const stubB = await plainReply(originB, 'unpaired', true);

    expect(stubA.type).toBe(Beacon.MessageType.Disconnect);
    expect(stubA.senderId).toBe(await Beacon.getSenderId(originA));
    expect(stubA.senderId).not.toBe(stubB.senderId);
  });

  it('does not reveal a cross-origin senderId in the plaintext Error reply', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const unknown = Beacon.encodeMessage({ type: 'unknown', version: '2', id: 'probe-1' });

    const errorA = await plainReply(originA, unknown);
    const errorB = await plainReply(originB, unknown);

    expect(errorA.type).toBe(Beacon.MessageType.Error);
    expect(errorA.senderId).toBe(await Beacon.getSenderId(originA));
    expect(errorA.senderId).not.toBe(errorB.senderId);

    consoleLogSpy.mockRestore();
  });

  it('answers a dApp still holding its pre-update wallet key with a per-origin Disconnect, never the old senderId', async () => {
    // The Beacon dApp SDK only reads encryptedPayload from the wallet, so this plaintext stub cannot
    // trigger the dApp's own peer cleanup whatever senderId it carries; echoing the old one would only leak it
    const origin = 'https://paired-before-update.example';
    const perOriginSenderId = await Beacon.getSenderId(origin);
    // The install-wide wallet key and senderId every dApp was given before per-origin derivation,
    // derived from the same stored seed the wallet reads (Beacon's own storage instance)
    const beaconStorage = jest.requireActual('webextension-polyfill').storage.local;
    const { beacon_keypair_seed: seed } = await beaconStorage.get(['beacon_keypair_seed']);
    const preUpdateWalletKeyPair = crypto_sign_seed_keypair(crypto_generichash(32, from_string(seed)));
    const preUpdateSenderId = bs58check.encode(Buffer.from(crypto_generichash(5, preUpdateWalletKeyPair.publicKey)));
    await Beacon.saveDAppPublicKey(origin, pagePublicKey);

    // A message sealed to the pre-update wallet key does not decrypt under the per-origin key
    const stub = await plainReply(origin, 'ab'.repeat(64), true);

    expect(stub.type).toBe(Beacon.MessageType.Disconnect);
    expect(stub.senderId).toBe(perOriginSenderId);
    expect(stub.senderId).not.toBe(preUpdateSenderId);
    expect(mockedRemoveDAppPublicKey).toHaveBeenCalledWith(origin);

    await beaconStorage.remove(Beacon.toPubKeyStorageKey(origin));
  });
});
