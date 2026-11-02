import { MavrykToolkit, Signer } from '@mavrykdynamics/webmavryk';
import { RpcClient } from '@mavrykdynamics/webmavryk-rpc';
import browser from 'webextension-polyfill';

import { WALLETS_SPECS_STORAGE_KEY } from 'lib/constants';
import * as Helpers from 'lib/temple/helpers';
import * as Passworder from 'lib/temple/passworder';
import { TempleAccount, TempleAccountType, TempleChainKind } from 'lib/temple/types';

import { PublicError } from '../PublicError';

import { MIGRATIONS } from './migrations';
import { createMemorySigner, mnemonicToTezosAccountCreds } from './misc';
import { encryptAndSaveMany, fetchAndDecryptOne, isStored, savePlain } from './safe-storage';
import * as SessionStore from './session-store';
import {
  accPrivKeyStrgKey,
  accountsStrgKey,
  checkStrgKey,
  migrationLevelStrgKey,
  mnemonicStrgKey,
  walletMnemonicStrgKey
} from './storage-keys';

import { Vault } from './index';

jest.mock(
  'wasm-themis',
  () => ({
    initialize: jest.fn(),
    SecureCellSeal: { withPassphrase: () => ({ encrypt: (payload: Uint8Array) => payload }) }
  }),
  { virtual: true }
);

jest.mock('./session-store', () => ({
  ...jest.requireActual('./session-store'),
  getSessionPassKey: jest.fn(),
  removeSession: jest.fn()
}));

const mockedGetSessionPassKey = SessionStore.getSessionPassKey as jest.MockedFunction<
  typeof SessionStore.getSessionPassKey
>;
const mockedRemoveSession = SessionStore.removeSession as jest.MockedFunction<typeof SessionStore.removeSession>;

const PASSWORD = 'contacts-key-password';
const HD_WALLET_ID = 'wallet-1';
const OTHER_HD_WALLET_ID = 'wallet-2';
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER_MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const HD_BOOK_ADDR = 'mv1HmdN1hRxhJW1aeLpGJdvAuBY48z38JjVq';
const HD_CONTACTS_KEY = 'VSYYIdcn152RonVoIgDuA5HbGQRmYNurQKoWMfrK9w8=';
const HD_LEGACY_GCM_CONTACTS_KEY = 'T6SG4pNv8Ff1/v0SPlfa5cEdG0Lx770K4vsn1Rl2wJ0=';
const IMPORTED_PRIVATE_KEY_SEED = 'edsk4BBVKnpwdnJrx9PB4hLkXZHtceSdSZVTfKBXArhmZ3Jg87Lcxi';
const IMPORTED_PRIVATE_KEY_CANONICAL =
  'edskS3wZrW6P38vvgnrHqjuLLz76vy5dv9QduxAQ2yG7WL5WjEubiJQUcwS49tFfwym1MBioLATPzQFckaYgGhWBUS7nmikuME';
const IMPORTED_CONTACTS_KEY = 'olY3X/PJDm0HDDbb/UnhtHwIJ2lw+kCY6ze9GcngKD8=';
const IMPORTED_CANONICAL_LEGACY_GCM_CONTACTS_KEY = 'QnbW1Vd4iulU9oSUNYOOcXCdAXN6p2/5XgwFWmHZ/WE=';
const IMPORTED_STORED_FORM_CONTACTS_KEY = 'W/Qtg/a/Lgm+emlswqBMZ95DwC5vU/ejqNJ8aGzDkyE=';
const IMPORTED_STORED_FORM_LEGACY_GCM_CONTACTS_KEY = 'RPR11O9HF8xoqyqbTJ+3EPLcxTIMrYO1AcsZxkjuWu0=';

let passKey: CryptoKey;

function buildHdAccount(publicKeyHash: string, hdIndex: number, walletId = HD_WALLET_ID): TempleAccount {
  return {
    id: `${walletId}-${hdIndex}`,
    type: TempleAccountType.HD,
    name: `HD ${hdIndex}`,
    publicKeyHash,
    hdIndex,
    walletId,
    isKYC: undefined
  };
}

function buildImportedAccount(publicKeyHash: string): TempleAccount {
  return {
    id: `imported-${publicKeyHash}`,
    type: TempleAccountType.Imported,
    name: 'Imported',
    publicKeyHash,
    chain: TempleChainKind.Tezos,
    isKYC: undefined
  };
}

async function saveAccounts(accounts: TempleAccount[], extraItems: [string, unknown][] = []) {
  await encryptAndSaveMany([[accountsStrgKey, accounts], ...extraItems], passKey);
}

describe('Vault contacts key derivation', () => {
  beforeAll(async () => {
    passKey = await Passworder.generateKey(PASSWORD);
  });

  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('derives a pinned HD book address and contacts key from the wallet seed', async () => {
    const [bookCreds, childCreds] = await Promise.all([
      mnemonicToTezosAccountCreds(MNEMONIC, 0),
      mnemonicToTezosAccountCreds(MNEMONIC, 1)
    ]);
    const accounts = [buildHdAccount(bookCreds.address, 0), buildHdAccount(childCreds.address, 1)];

    await saveAccounts(accounts, [[walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC]]);

    const vault = new Vault(passKey);
    const childResult = await vault.deriveContactsKey(childCreds.address);
    const unlockedAgainResult = await new Vault(passKey).deriveContactsKey(bookCreds.address);

    expect(childResult).toEqual({
      status: 'available',
      key: HD_CONTACTS_KEY,
      legacyKeys: [HD_LEGACY_GCM_CONTACTS_KEY],
      bookAddr: HD_BOOK_ADDR,
      identityKind: 'hd'
    });
    expect(unlockedAgainResult).toEqual(childResult);
  });

  it('keeps an HD group key local to that group when another group is added or removed', async () => {
    const [bookCreds, otherBookCreds] = await Promise.all([
      mnemonicToTezosAccountCreds(MNEMONIC, 0),
      mnemonicToTezosAccountCreds(OTHER_MNEMONIC, 0)
    ]);
    const mainAccount = buildHdAccount(bookCreds.address, 0);
    const otherAccount = buildHdAccount(otherBookCreds.address, 0, OTHER_HD_WALLET_ID);

    await saveAccounts([mainAccount], [[walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC]]);
    const initialResult = await new Vault(passKey).deriveContactsKey(bookCreds.address);

    await saveAccounts(
      [mainAccount, otherAccount],
      [
        [walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC],
        [walletMnemonicStrgKey(OTHER_HD_WALLET_ID), OTHER_MNEMONIC]
      ]
    );
    const withOtherGroupResult = await new Vault(passKey).deriveContactsKey(bookCreds.address);

    await saveAccounts([mainAccount], [[walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC]]);
    const afterRemovalResult = await new Vault(passKey).deriveContactsKey(bookCreds.address);

    expect(initialResult).toEqual({
      status: 'available',
      key: HD_CONTACTS_KEY,
      legacyKeys: [HD_LEGACY_GCM_CONTACTS_KEY],
      bookAddr: HD_BOOK_ADDR,
      identityKind: 'hd'
    });
    expect(withOtherGroupResult).toEqual(initialResult);
    expect(afterRemovalResult).toEqual(initialResult);
  });

  it('derives the same imported contacts key from equivalent private-key spellings', async () => {
    const signer = await createMemorySigner(IMPORTED_PRIVATE_KEY_SEED);
    const publicKeyHash = await signer.publicKeyHash();
    const account = buildImportedAccount(publicKeyHash);

    await saveAccounts([account], [[accPrivKeyStrgKey(publicKeyHash), IMPORTED_PRIVATE_KEY_SEED]]);
    const seedFormResult = await new Vault(passKey).deriveContactsKey(publicKeyHash);

    await browser.storage.local.clear();
    await saveAccounts([account], [[accPrivKeyStrgKey(publicKeyHash), IMPORTED_PRIVATE_KEY_CANONICAL]]);
    const canonicalFormResult = await new Vault(passKey).deriveContactsKey(publicKeyHash);

    expect(seedFormResult).toEqual({
      status: 'available',
      key: IMPORTED_CONTACTS_KEY,
      legacyKeys: [
        IMPORTED_CANONICAL_LEGACY_GCM_CONTACTS_KEY,
        IMPORTED_STORED_FORM_CONTACTS_KEY,
        IMPORTED_STORED_FORM_LEGACY_GCM_CONTACTS_KEY
      ],
      bookAddr: publicKeyHash,
      identityKind: 'imported'
    });
    expect(canonicalFormResult).toMatchObject({
      status: 'available',
      key: IMPORTED_CONTACTS_KEY,
      legacyKeys: [IMPORTED_CANONICAL_LEGACY_GCM_CONTACTS_KEY],
      bookAddr: publicKeyHash,
      identityKind: 'imported'
    });
  });
});

it('unlocks an existing vault with a password below the new-vault policy', async () => {
  await browser.storage.local.clear();
  const legacyPassword = 'old';
  const legacyPassKey = await Passworder.generateKey(legacyPassword);
  await encryptAndSaveMany([[checkStrgKey, 'legacy-check']], legacyPassKey);
  await savePlain(migrationLevelStrgKey, MIGRATIONS.length);

  await expect(Vault.setup(legacyPassword)).resolves.toBeInstanceOf(Vault);
});

describe('Vault.recoverFromSession', () => {
  const account = buildImportedAccount('mv1HmdN1hRxhJW1aeLpGJdvAuBY48z38JjVq');

  beforeAll(async () => {
    passKey = await Passworder.generateKey(PASSWORD);
  });

  beforeEach(async () => {
    await browser.storage.local.clear();
    mockedGetSessionPassKey.mockReset();
    mockedRemoveSession.mockReset();
  });

  it('returns the vault with the accounts it decrypted to validate the session key', async () => {
    await saveAccounts([account], [[checkStrgKey, 'check']]);
    mockedGetSessionPassKey.mockResolvedValue(passKey);

    const recovered = await Vault.recoverFromSession();

    expect(recovered?.vault).toBeInstanceOf(Vault);
    expect(recovered?.accounts).toEqual([account]);
    expect(mockedRemoveSession).not.toHaveBeenCalled();
  });

  it('removes the session and stays locked when the session key cannot decrypt the accounts', async () => {
    await saveAccounts([account], [[checkStrgKey, 'check']]);
    mockedGetSessionPassKey.mockResolvedValue(await Passworder.generateKey('another-password'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(Vault.recoverFromSession()).resolves.toBeNull();
    expect(mockedRemoveSession).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  it('returns null without decrypting when no session key is saved', async () => {
    mockedGetSessionPassKey.mockResolvedValue(undefined);

    await expect(Vault.recoverFromSession()).resolves.toBeNull();
    expect(mockedRemoveSession).not.toHaveBeenCalled();
  });
});

describe('Vault HD wallet removal', () => {
  let mainCreds: Awaited<ReturnType<typeof mnemonicToTezosAccountCreds>>;
  let childCreds: Awaited<ReturnType<typeof mnemonicToTezosAccountCreds>>;
  let otherCreds: Awaited<ReturnType<typeof mnemonicToTezosAccountCreds>>;

  beforeAll(async () => {
    passKey = await Passworder.generateKey(PASSWORD);
    [mainCreds, childCreds, otherCreds] = await Promise.all([
      mnemonicToTezosAccountCreds(MNEMONIC, 0),
      mnemonicToTezosAccountCreds(MNEMONIC, 1),
      mnemonicToTezosAccountCreds(OTHER_MNEMONIC, 0)
    ]);
  });

  beforeEach(async () => {
    await browser.storage.local.clear();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function seedTwoWallets(mainWalletAccounts = [buildHdAccount(mainCreds.address, 0)]) {
    await saveAccounts(
      [...mainWalletAccounts, buildHdAccount(otherCreds.address, 0, OTHER_HD_WALLET_ID)],
      [
        [checkStrgKey, 'check'],
        [walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC],
        [walletMnemonicStrgKey(OTHER_HD_WALLET_ID), OTHER_MNEMONIC]
      ]
    );
    await savePlain(WALLETS_SPECS_STORAGE_KEY, {
      [HD_WALLET_ID]: { name: 'A', createdAt: 1 },
      [OTHER_HD_WALLET_ID]: { name: 'B', createdAt: 2 }
    });
  }

  it('deletes the removed HD wallet seed and refuses to reveal it afterwards', async () => {
    await seedTwoWallets();

    await Vault.removeHdWallet(OTHER_HD_WALLET_ID, PASSWORD);

    expect(await isStored(walletMnemonicStrgKey(OTHER_HD_WALLET_ID))).toBe(false);
    await expect(Vault.revealMnemonic(OTHER_HD_WALLET_ID, PASSWORD)).rejects.toThrow('Failed to reveal seed phrase');
    await expect(Vault.revealMnemonic(HD_WALLET_ID, PASSWORD)).resolves.toBe(MNEMONIC);
  });

  it('deletes the seed when the last account of an HD wallet is removed', async () => {
    await seedTwoWallets();

    await Vault.removeAccount(`${OTHER_HD_WALLET_ID}-0`, PASSWORD);

    expect(await isStored(walletMnemonicStrgKey(OTHER_HD_WALLET_ID))).toBe(false);
    await expect(Vault.revealMnemonic(OTHER_HD_WALLET_ID, PASSWORD)).rejects.toThrow('Failed to reveal seed phrase');
    await expect(Vault.revealMnemonic(HD_WALLET_ID, PASSWORD)).resolves.toBe(MNEMONIC);
  });

  it('keeps the seed while the HD wallet still has accounts', async () => {
    await seedTwoWallets([buildHdAccount(mainCreds.address, 0), buildHdAccount(childCreds.address, 1)]);

    await Vault.removeAccount(`${HD_WALLET_ID}-1`, PASSWORD);

    await expect(Vault.revealMnemonic(HD_WALLET_ID, PASSWORD)).resolves.toBe(MNEMONIC);
  });

  it('refuses to reveal a stored seed whose wallet is no longer listed', async () => {
    await seedTwoWallets();
    await savePlain(WALLETS_SPECS_STORAGE_KEY, { [HD_WALLET_ID]: { name: 'A', createdAt: 1 } });

    await expect(Vault.revealMnemonic(OTHER_HD_WALLET_ID, PASSWORD)).rejects.toThrow('Failed to reveal seed phrase');
  });

  it('builds the sync payload from a live HD wallet seed instead of the legacy entry', async () => {
    await seedTwoWallets();
    await encryptAndSaveMany([[mnemonicStrgKey, 'removed legacy seed']], passKey);

    const payload = await Vault.generateSyncPayload(PASSWORD);
    const encodedPrefix = Buffer.from('templesync').toString('base64');
    const decoded = JSON.parse(Buffer.from(payload.slice(encodedPrefix.length), 'base64').toString());

    expect(decoded).toEqual([MNEMONIC, 1]);
  });

  it('refuses to build the sync payload when no HD wallet is listed', async () => {
    await seedTwoWallets();
    await encryptAndSaveMany([[mnemonicStrgKey, MNEMONIC]], passKey);
    await savePlain(WALLETS_SPECS_STORAGE_KEY, {});

    await expect(Vault.generateSyncPayload(PASSWORD)).rejects.toThrow('Failed to generate sync payload');
  });
});

describe('Vault legacy seed clean-up migration', () => {
  const runCleanupMigration = MIGRATIONS[MIGRATIONS.length - 1];

  beforeAll(async () => {
    passKey = await Passworder.generateKey(PASSWORD);
  });

  beforeEach(async () => {
    await browser.storage.local.clear();
    await encryptAndSaveMany([[checkStrgKey, 'check']], passKey);
  });

  async function seedLiveWallet() {
    await encryptAndSaveMany([[walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC]], passKey);
    await savePlain(WALLETS_SPECS_STORAGE_KEY, { [HD_WALLET_ID]: { name: 'A', createdAt: 1 } });
  }

  it('removes the legacy seed once a live wallet holds the same seed', async () => {
    await seedLiveWallet();
    await encryptAndSaveMany([[mnemonicStrgKey, MNEMONIC]], passKey);

    await runCleanupMigration(PASSWORD);

    expect(await isStored(mnemonicStrgKey)).toBe(false);
    await expect(fetchAndDecryptOne(walletMnemonicStrgKey(HD_WALLET_ID), passKey)).resolves.toBe(MNEMONIC);
  });

  it('removes the leftover legacy seed of a removed wallet when a different live wallet exists', async () => {
    await seedLiveWallet();
    await encryptAndSaveMany([[mnemonicStrgKey, OTHER_MNEMONIC]], passKey);

    await runCleanupMigration(PASSWORD);

    expect(await isStored(mnemonicStrgKey)).toBe(false);
    await expect(fetchAndDecryptOne(walletMnemonicStrgKey(HD_WALLET_ID), passKey)).resolves.toBe(MNEMONIC);
  });

  it('keeps the legacy seed when no wallet specs exist', async () => {
    await encryptAndSaveMany([[mnemonicStrgKey, MNEMONIC]], passKey);

    await runCleanupMigration(PASSWORD);

    await expect(fetchAndDecryptOne(mnemonicStrgKey, passKey)).resolves.toBe(MNEMONIC);
  });

  it('keeps the legacy seed when wallet specs are empty', async () => {
    await savePlain(WALLETS_SPECS_STORAGE_KEY, {});
    await encryptAndSaveMany([[mnemonicStrgKey, MNEMONIC]], passKey);

    await runCleanupMigration(PASSWORD);

    await expect(fetchAndDecryptOne(mnemonicStrgKey, passKey)).resolves.toBe(MNEMONIC);
  });

  it('keeps the legacy seed when a listed wallet has no seed entry', async () => {
    await savePlain(WALLETS_SPECS_STORAGE_KEY, { [HD_WALLET_ID]: { name: 'A', createdAt: 1 } });
    await encryptAndSaveMany([[mnemonicStrgKey, MNEMONIC]], passKey);

    await runCleanupMigration(PASSWORD);

    await expect(fetchAndDecryptOne(mnemonicStrgKey, passKey)).resolves.toBe(MNEMONIC);
  });

  it('keeps the legacy seed when only some listed wallets have a seed entry', async () => {
    await seedLiveWallet();
    await savePlain(WALLETS_SPECS_STORAGE_KEY, {
      [HD_WALLET_ID]: { name: 'A', createdAt: 1 },
      [OTHER_HD_WALLET_ID]: { name: 'B', createdAt: 2 }
    });
    await encryptAndSaveMany([[mnemonicStrgKey, OTHER_MNEMONIC]], passKey);

    await runCleanupMigration(PASSWORD);

    await expect(fetchAndDecryptOne(mnemonicStrgKey, passKey)).resolves.toBe(OTHER_MNEMONIC);
  });

  it('skips silently when there is no legacy seed', async () => {
    await seedLiveWallet();

    await expect(runCleanupMigration(PASSWORD)).resolves.toBeUndefined();
    await expect(fetchAndDecryptOne(walletMnemonicStrgKey(HD_WALLET_ID), passKey)).resolves.toBe(MNEMONIC);
  });

  it('runs on unlock for a vault at the previous migration level', async () => {
    await seedLiveWallet();
    await encryptAndSaveMany([[mnemonicStrgKey, MNEMONIC]], passKey);
    await savePlain(migrationLevelStrgKey, MIGRATIONS.length - 1);

    await expect(Vault.setup(PASSWORD)).resolves.toBeInstanceOf(Vault);

    expect(await isStored(mnemonicStrgKey)).toBe(false);
    expect((await browser.storage.local.get(migrationLevelStrgKey))[migrationLevelStrgKey]).toBe(MIGRATIONS.length);
  });
});

describe('Vault.sendOperations', () => {
  const OP_BYTES = '00'.repeat(32) + '6c00';
  const ACCOUNT_PKH = 'mv1HmdN1hRxhJW1aeLpGJdvAuBY48z38JjVq';
  const RPC = 'https://rpc.example';
  const accountSigner = {
    sign: jest.fn().mockResolvedValue({ sbytes: 'signed', prefixSig: 'sig' }),
    publicKey: jest.fn(),
    publicKeyHash: jest.fn(),
    secretKey: jest.fn()
  };

  beforeEach(() => {
    accountSigner.sign.mockClear();
    jest.spyOn(Vault.prototype as any, 'getSigner').mockResolvedValue({ signer: accountSigner, cleanup: jest.fn() });
    // Stands in for the toolkit's batch send: it forges the operation and hands the bytes to the signer provider.
    let signerProvider: Signer | undefined;
    jest.spyOn(MavrykToolkit.prototype, 'setSignerProvider').mockImplementation(signer => {
      signerProvider = signer;
    });
    jest
      .spyOn(MavrykToolkit.prototype, 'contract', 'get')
      .mockReturnValue({ batch: () => ({ send: () => signerProvider!.sign(OP_BYTES) }) } as any);
    jest.spyOn(Helpers, 'loadFastRpcClient').mockReturnValue(new RpcClient(RPC) as any);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('does not reach the account signer when the beforeSign check refuses the operation bytes', async () => {
    const refusal = new PublicError('This RPC serves an operation for a known Mavryk network. Signing was refused.');
    const beforeSign = jest.fn().mockRejectedValue(refusal);

    await expect(new Vault(passKey).sendOperations(ACCOUNT_PKH, RPC, [], beforeSign)).rejects.toThrow(refusal.message);

    expect(beforeSign).toHaveBeenCalledWith(OP_BYTES);
    expect(accountSigner.sign).not.toHaveBeenCalled();
  });

  it('signs the operation bytes once the beforeSign check passes', async () => {
    const beforeSign = jest.fn().mockResolvedValue(undefined);

    await new Vault(passKey).sendOperations(ACCOUNT_PKH, RPC, [], beforeSign);

    expect(beforeSign).toHaveBeenCalledWith(OP_BYTES);
    expect(accountSigner.sign).toHaveBeenCalledWith(OP_BYTES, undefined);
    expect(beforeSign.mock.invocationCallOrder[0]).toBeLessThan(accountSigner.sign.mock.invocationCallOrder[0]);
  });
});
