import { CompositeForger, RpcForger, Signer, MavrykOperationError, MavrykToolkit } from '@mavrykdynamics/webmavryk';
import { HttpResponseError } from '@mavrykdynamics/webmavryk-http-utils';
import { localForger } from '@mavrykdynamics/webmavryk-local-forging';
import * as WebMavrykUtils from '@mavrykdynamics/webmavryk-utils';
import * as Bip39 from 'bip39';
import { nanoid } from 'nanoid';
import type * as WasmThemisPackageInterface from 'wasm-themis';

import { getKYCStatus } from 'lib/apis/mvkt/api';
import {
  ACCOUNT_ALREADY_EXISTS_ERR_MSG,
  ACCOUNT_NAME_COLLISION_ERR_MSG,
  AT_LEAST_ONE_HD_ACCOUNT_ERR_MSG,
  WALLETS_SPECS_STORAGE_KEY
} from 'lib/constants';
import {
  formatOpParamsBeforeSend,
  getSameGroupAccounts,
  isNameCollision,
  loadFastRpcClient,
  michelEncoder
} from 'lib/temple/helpers';
import * as Passworder from 'lib/temple/passworder';
import { clearAsyncStorages } from 'lib/temple/reset';
import {
  SaveLedgerAccountInput,
  TempleAccount,
  TempleAccountType,
  TempleChainKind,
  TempleSettings,
  WalletSpecs
} from 'lib/temple/types';
import { isTruthy } from 'lib/utils';
import { getAccountAddressForChain, getAccountAddressForTezos } from 'mavryk/accounts';

import { createLedgerSigner } from '../ledger';
import { PublicError } from '../PublicError';

import { fetchMessage, fetchNewGroupName, toExcelColumnName, transformHttpResponseError } from './helpers';
import { MIGRATIONS } from './migrations';
import {
  seedToPrivateKey,
  deriveSeed,
  generateCheck,
  fetchNewAccountName,
  concatAccount,
  createMemorySigner,
  withError,
  mnemonicToTezosAccountCreds,
  buildEncryptAndSaveManyForAccount,
  privateKeyToTezosAccountCreds,
  canRemoveAccounts
} from './misc';
import {
  encryptAndSaveMany,
  fetchAndDecryptOne,
  fetchAndDecryptOneLegacy,
  getPlain,
  getPlainLegacy,
  isStored,
  isStoredLegacy,
  removeMany,
  removeManyLegacy,
  savePlain,
  savePlainLegacy
} from './safe-storage';
import * as SessionStore from './session-store';
import {
  checkStrgKey,
  migrationLevelStrgKey,
  mnemonicStrgKey,
  accPrivKeyStrgKey,
  accPubKeyStrgKey,
  accountsStrgKey,
  settingsStrgKey,
  legacyMigrationLevelStrgKey,
  walletMnemonicStrgKey
} from './storage-keys';

const TEMPLE_SYNC_PREFIX = 'templesync';
const DEFAULT_SETTINGS: TempleSettings = {};
const libthemisWasmSrc = '/wasm/libthemis.wasm';

const WALLET_NAME_MAX_LENGTH = 64;
const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/;
const CONTROL_CHAR_REPLACE_REGEX = /[\x00-\x1F\x7F]/g;

/**
 * Sanitize a wallet name read from storage (read-time path).
 * Strips control characters and truncates to WALLET_NAME_MAX_LENGTH.
 * Warns if truncation occurs so corrupted/legacy data stays visible in the UI.
 */
function sanitizeWalletName(name: string, walletId: string): string {
  const stripped = name.replace(CONTROL_CHAR_REPLACE_REGEX, '');
  if (stripped.length > WALLET_NAME_MAX_LENGTH) {
    console.warn(`[Vault] Wallet name for id "${walletId}" exceeds ${WALLET_NAME_MAX_LENGTH} chars — truncating.`);
    return stripped.slice(0, WALLET_NAME_MAX_LENGTH);
  }
  return stripped;
}

/**
 * Validate a wallet name at write time. Throws a user-visible error on violation.
 */
function validateWalletName(name: string): void {
  if (name.length > WALLET_NAME_MAX_LENGTH) {
    throw new PublicError(`Wallet name must be ${WALLET_NAME_MAX_LENGTH} characters or fewer`);
  }
  if (CONTROL_CHAR_REGEX.test(name)) {
    throw new PublicError('Wallet name contains invalid characters');
  }
}

interface RemoveAccountEventPayload {
  publicKeyhash?: string;
}

export class Vault {
  static removeAccountsListeners: SyncFn<RemoveAccountEventPayload[]>[] = [];
  static async isExist() {
    const stored = await isStored(checkStrgKey);
    if (stored) return stored;

    return isStoredLegacy(checkStrgKey);
  }

  static async setup(password: string, saveSession = false) {
    return withError('Failed to unlock wallet', async () => {
      await Vault.runMigrations(password);

      const { passHash, passKey } = await Vault.toValidPassKey(password);

      if (saveSession) await SessionStore.savePassHash(passHash);

      return new Vault(passKey);
    });
  }

  static async recoverFromSession() {
    const passHash = await SessionStore.getPassHash();
    if (!passHash) return null;
    const passKey = await Passworder.importKey(passHash);
    return new Vault(passKey);
  }

  static forgetSession() {
    return SessionStore.removePassHash();
  }

  /**
   * Creates a new wallet and saves it securely.
   * @param password Password for encryption
   * @param mnemonic Seed phrase
   * @returns Initial account address
   */
  static async spawn(password: string, mnemonic?: string) {
    return withError('Failed to create wallet', async () => {
      if (!mnemonic) {
        mnemonic = Bip39.generateMnemonic(128);
      }

      const hdAccIndex = 0;

      const tezosAcc = await mnemonicToTezosAccountCreds(mnemonic, hdAccIndex);

      const walletId = nanoid();
      const walletName = await fetchMessage('hdWalletDefaultName', 'A');
      validateWalletName(walletName);
      const initialAccount: TempleAccount = {
        id: nanoid(),
        type: TempleAccountType.HD,
        name: await fetchMessage('defaultAccountName', '1'),
        hdIndex: hdAccIndex,
        publicKeyHash: tezosAcc.address,
        walletId,
        isKYC: undefined
      };
      const newAccounts = [initialAccount];

      const passKey = await Passworder.generateKey(password);

      await SessionStore.removePassHash();

      await clearAsyncStorages();

      await encryptAndSaveMany(
        [
          [checkStrgKey, generateCheck()],
          [walletMnemonicStrgKey(walletId), mnemonic],
          ...buildEncryptAndSaveManyForAccount(tezosAcc),
          [accountsStrgKey, newAccounts]
        ],
        passKey
      );
      await savePlain<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY, {
        [walletId]: { name: walletName, createdAt: Date.now() }
      });
      await savePlain(migrationLevelStrgKey, MIGRATIONS.length);

      return tezosAcc.address;
    });
  }

  static async runMigrations(password: string) {
    await Vault.assertValidPassword(password);

    let migrationLevel: number;

    const legacyMigrationLevelStored = await isStoredLegacy(legacyMigrationLevelStrgKey);

    if (legacyMigrationLevelStored) {
      migrationLevel = await withError('Invalid password', async () => {
        const legacyPassKey = await Passworder.generateKeyLegacy(password);
        return fetchAndDecryptOneLegacy<number>(legacyMigrationLevelStrgKey, legacyPassKey);
      });
    } else {
      const saved = await getPlainLegacy<number>(migrationLevelStrgKey);

      migrationLevel = saved ?? 0;

      /**
       * The code below is a fix for production issue that occurred
       * due to an incorrect migration to the new migration type.
       *
       * The essence of the problem:
       * if you enter the password incorrectly after the upgrade,
       * the migration will not work (as it should),
       * but it will save that it passed.
       * And the next unlock attempt will go on a new path.
       *
       * Solution:
       * Check if there is an legacy version of checkStrgKey field in storage
       * and if there is both it and new migration record,
       * then overwrite migration level.
       */

      const legacyCheckStored = await isStoredLegacy(checkStrgKey);

      if (saved !== undefined && legacyCheckStored) {
        // Override migration level, force
        migrationLevel = 3;
      }
    }

    const migrationsToRun = MIGRATIONS.filter((_m, i) => i >= migrationLevel);

    if (migrationsToRun.length === 0) {
      return;
    }

    try {
      for (let i = 0; i < migrationsToRun.length; i++) {
        await migrationsToRun[i](password);
        // Save progress after each successful step so a partial migration can resume
        await savePlainLegacy(migrationLevelStrgKey, migrationLevel + i + 1);
      }
    } catch (migrationErr) {
      console.error('Vault migration failed:', migrationErr instanceof Error ? migrationErr.message : migrationErr);
      throw new PublicError('Wallet upgrade failed. Please contact support.');
    }

    // Remove legacy key only after all migrations complete
    if (legacyMigrationLevelStored) {
      await removeManyLegacy([legacyMigrationLevelStrgKey]);
    }
  }

  static async revealMnemonic(walletId: string, password: string) {
    const { passKey } = await Vault.toValidPassKey(password);
    return withError('Failed to reveal seed phrase', () =>
      fetchAndDecryptOne<string>(walletMnemonicStrgKey(walletId), passKey)
    );
  }
  static async generateSyncPayload(password: string) {
    let WasmThemis: typeof WasmThemisPackageInterface;
    try {
      WasmThemis = await import('wasm-themis');
      await WasmThemis.initialize(libthemisWasmSrc);
    } catch (error) {
      console.error(error);
    }

    const { passKey } = await Vault.toValidPassKey(password);
    return withError('Failed to generate sync payload', async () => {
      const [mnemonic, allAccounts] = await Promise.all([
        fetchAndDecryptOne<string>(mnemonicStrgKey, passKey),
        fetchAndDecryptOne<TempleAccount[]>(accountsStrgKey, passKey)
      ]);

      const hdAccounts = allAccounts.filter(acc => acc.type === TempleAccountType.HD);

      const data = [mnemonic, hdAccounts.length];

      const payload = Uint8Array.from(Buffer.from(JSON.stringify(data)));
      const cell = WasmThemis.SecureCellSeal.withPassphrase(password);
      const encrypted = cell.encrypt(payload);

      return [TEMPLE_SYNC_PREFIX, encrypted].map(item => Buffer.from(item).toString('base64')).join('');
    });
  }

  static async revealPrivateKey(accPublicKeyHash: string, password: string) {
    const { passKey } = await Vault.toValidPassKey(password);
    return withError('Failed to reveal private key', async () => {
      const privateKeySeed = await fetchAndDecryptOne<string>(accPrivKeyStrgKey(accPublicKeyHash), passKey);
      const signer = await createMemorySigner(privateKeySeed);
      return signer.secretKey();
    });
  }

  private static async removeAccountsKeys(accounts: TempleAccount[]) {
    const accAddresses = Object.values(TempleChainKind)
      .map(chain => accounts.map(acc => getAccountAddressForChain(acc, chain)))
      .flat()
      .filter(isTruthy);

    await removeMany(accAddresses.map(address => [accPrivKeyStrgKey(address), accPubKeyStrgKey(address)]).flat());
    Vault.removeAccountsListeners.forEach(fn =>
      fn(
        accounts.map(account => ({
          publicKeyhash: getAccountAddressForTezos(account)
        }))
      )
    );
  }

  static async removeAccount(id: string, password: string) {
    const { passKey } = await Vault.toValidPassKey(password);
    return withError('Failed to remove account', async doThrow => {
      const allAccounts = await fetchAndDecryptOne<TempleAccount[]>(accountsStrgKey, passKey);
      const acc = allAccounts.find(a => a.id === id);

      if (!acc) {
        throw doThrow();
      }

      if (!canRemoveAccounts(allAccounts, [acc])) {
        throw new PublicError(AT_LEAST_ONE_HD_ACCOUNT_ERR_MSG);
      }

      const newAccounts = allAccounts.filter(currentAccount => currentAccount.id !== id);
      const allHdWalletsEntries = Object.entries(
        (await getPlain<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY)) ?? {}
      );
      const newWalletsSpecs = Object.fromEntries(
        allHdWalletsEntries.filter(([walletId]) =>
          newAccounts.some(acc => acc.type === TempleAccountType.HD && acc.walletId === walletId)
        )
      );
      await encryptAndSaveMany([[accountsStrgKey, newAccounts]], passKey);
      await savePlain(WALLETS_SPECS_STORAGE_KEY, newWalletsSpecs);
      await Vault.removeAccountsKeys([acc]);

      return { newAccounts, newWalletsSpecs };
    });
  }

  static async removeHdWallet(id: string, password: string) {
    const { passKey } = await Vault.toValidPassKey(password);

    return withError('Failed to remove HD group', async doThrow => {
      const walletsSpecs = (await getPlain<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY)) ?? {};

      if (!(id in walletsSpecs)) {
        throw doThrow();
      }

      const allAccounts = await fetchAndDecryptOne<TempleAccount[]>(accountsStrgKey, passKey);
      const accountsToRemove: TempleAccount[] = getSameGroupAccounts(allAccounts, TempleAccountType.HD, id);

      if (!canRemoveAccounts(allAccounts, accountsToRemove)) {
        throw new PublicError(AT_LEAST_ONE_HD_ACCOUNT_ERR_MSG);
      }

      const newAccounts = allAccounts.filter(acc => !accountsToRemove.includes(acc));
      const { [id]: oldGroupName, ...newWalletsSpecs } = walletsSpecs;
      await encryptAndSaveMany([[accountsStrgKey, newAccounts]], passKey);
      await savePlain<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY, newWalletsSpecs);
      await Vault.removeAccountsKeys(accountsToRemove);

      return { newAccounts, newWalletsSpecs };
    });
  }

  static async removeAccountsByType(type: Exclude<TempleAccountType, TempleAccountType.HD>, password: string) {
    const { passKey } = await Vault.toValidPassKey(password);

    return withError('Failed to remove accounts', async () => {
      const allAccounts = await fetchAndDecryptOne<TempleAccount[]>(accountsStrgKey, passKey);
      const accountsToRemove = allAccounts.filter(acc => acc.type === type);
      const newAccounts = allAccounts.filter(acc => acc.type !== type);
      await encryptAndSaveMany([[accountsStrgKey, newAccounts]], passKey);
      await Vault.removeAccountsKeys(accountsToRemove);

      return newAccounts;
    });
  }

  private static toValidPassKey(password: string) {
    return withError('Invalid password', async doThrow => {
      const passHash = await Passworder.generateHash(password);
      const passKey = await Passworder.importKey(passHash);
      try {
        await fetchAndDecryptOne<any>(checkStrgKey, passKey);
      } catch (error) {
        doThrow();
      }
      return { passHash, passKey };
    });
  }

  private static assertValidPassword(password: string) {
    return withError('Invalid password', async () => {
      const legacyCheckStored = await isStoredLegacy(checkStrgKey);
      if (legacyCheckStored) {
        const legacyPassKey = await Passworder.generateKeyLegacy(password);
        await fetchAndDecryptOneLegacy<any>(checkStrgKey, legacyPassKey);
      } else {
        const passKey = await Passworder.generateKey(password);
        await fetchAndDecryptOne<any>(checkStrgKey, passKey);
      }
    });
  }

  static async reset(password: string) {
    await Vault.assertValidPassword(password);
    await Vault.forgetSession();
    await clearAsyncStorages();
  }

  static subscribeToRemoveAccounts(fn: SyncFn<RemoveAccountEventPayload[]>) {
    Vault.removeAccountsListeners.push(fn);
  }

  static unsubscribeFromRemoveAccounts(fn: SyncFn<RemoveAccountEventPayload[]>) {
    Vault.removeAccountsListeners = Vault.removeAccountsListeners.filter(f => f !== fn);
  }

  constructor(private passKey: CryptoKey) {}

  revealPublicKey(accPublicKeyHash: string) {
    return withError('Failed to reveal public key', () =>
      fetchAndDecryptOne<string>(accPubKeyStrgKey(accPublicKeyHash), this.passKey)
    );
  }

  fetchAccounts() {
    return fetchAndDecryptOne<TempleAccount[]>(accountsStrgKey, this.passKey);
  }

  async fetchWalletsSpecs() {
    const raw = (await getPlain<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY)) ?? {};
    // Sanitize names at read time to handle corrupted or pre-validation legacy data
    return Object.fromEntries(
      Object.entries(raw).map(([walletId, specs]) => [
        walletId,
        { ...specs, name: sanitizeWalletName(specs.name, walletId) }
      ])
    ) as StringRecord<WalletSpecs>;
  }

  async fetchSettings() {
    let saved;
    try {
      saved = await fetchAndDecryptOne<TempleSettings>(settingsStrgKey, this.passKey);
    } catch {}
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
  }

  async findFreeHDAccountIndex(walletId: string) {
    return withError('Failed to find free HD account index', async doThrow => {
      const [mnemonic, allAccounts, walletsSpecs] = await Promise.all([
        fetchAndDecryptOne<string>(walletMnemonicStrgKey(walletId), this.passKey),
        this.fetchAccounts(),
        this.fetchWalletsSpecs()
      ]);

      if (!(walletId in walletsSpecs)) {
        throw doThrow();
      }

      const sameGroupHDAccounts = getSameGroupAccounts(allAccounts, TempleAccountType.HD, walletId);
      const startHdIndex = Math.max(-1, ...sameGroupHDAccounts.map(a => a.hdIndex ?? -1)) + 1;
      let firstSkippedAccount: TempleAccount | undefined;
      for (let skipsCount = 0; ; skipsCount++) {
        const hdIndex = startHdIndex + skipsCount;
        const tezosAcc = await mnemonicToTezosAccountCreds(mnemonic, hdIndex);
        const sameAddressAccount = allAccounts.find(acc => {
          if (acc.type === TempleAccountType.HD) {
            return false;
          }

          return getAccountAddressForTezos(acc) === tezosAcc.address;
        });

        if (sameAddressAccount && !firstSkippedAccount) {
          firstSkippedAccount = sameAddressAccount;
        } else if (!sameAddressAccount) {
          return { hdIndex, firstSkippedAccount };
        }
      }
    });
  }

  async createHDAccount(walletId: string, name?: string, hdAccIndex?: number): Promise<TempleAccount[]> {
    return withError('Failed to create account', async doThrow => {
      const [mnemonic, allAccounts, walletsSpecs] = await Promise.all([
        fetchAndDecryptOne<string>(walletMnemonicStrgKey(walletId), this.passKey),
        this.fetchAccounts(),
        this.fetchWalletsSpecs()
      ]);

      if (!(walletId in walletsSpecs)) {
        throw doThrow();
      }

      if (!hdAccIndex) {
        hdAccIndex = (await this.findFreeHDAccountIndex(walletId)).hdIndex;
      }

      const tezosAcc = await mnemonicToTezosAccountCreds(mnemonic, hdAccIndex);
      const sameAddressAccount = allAccounts.find(acc => {
        if (acc.type === TempleAccountType.HD) {
          return false;
        }

        return getAccountAddressForTezos(acc) === tezosAcc.address;
      });

      if (sameAddressAccount) {
        throw new PublicError(ACCOUNT_ALREADY_EXISTS_ERR_MSG);
      }

      const accName = name ?? (await fetchNewAccountName(allAccounts, TempleAccountType.HD, walletId));

      if (isNameCollision(allAccounts, TempleAccountType.HD, accName, walletId)) {
        throw new PublicError(ACCOUNT_NAME_COLLISION_ERR_MSG);
      }

      const newAccount: TempleAccount = {
        id: nanoid(),
        type: TempleAccountType.HD,
        name: accName,
        hdIndex: hdAccIndex,
        publicKeyHash: tezosAcc.address,
        isKYC: undefined,
        walletId
      };

      const newAllAccounts = concatAccount(allAccounts, newAccount);

      await encryptAndSaveMany(
        [...buildEncryptAndSaveManyForAccount(tezosAcc), [accountsStrgKey, newAllAccounts]],
        this.passKey
      );

      return newAllAccounts;
    });
  }

  async createOrImportWallet(mnemonic?: string) {
    return withError('Failed to create wallet', async () => {
      if (!mnemonic) {
        mnemonic = Bip39.generateMnemonic(128);
      }

      const hdAccIndex = 0;

      const walletsSpecs = await this.fetchWalletsSpecs();
      const groupsMnemonics = await Promise.all(
        Object.keys(walletsSpecs).map(walletId =>
          fetchAndDecryptOne<string>(walletMnemonicStrgKey(walletId), this.passKey)
        )
      );

      if (groupsMnemonics.some(m => m === mnemonic)) {
        throw new PublicError('This wallet is already imported');
      }

      const allAccounts = await this.fetchAccounts();
      const tezosAcc = await mnemonicToTezosAccountCreds(mnemonic, hdAccIndex);

      const walletId = nanoid();
      const walletName = await fetchNewGroupName(walletsSpecs, i =>
        fetchMessage('hdWalletDefaultName', toExcelColumnName(i))
      );
      validateWalletName(walletName);
      const accountToReplace = allAccounts.find(acc => {
        if (acc.type === TempleAccountType.HD) {
          return false;
        }

        return getAccountAddressForTezos(acc) === tezosAcc.address;
      });
      const newAccount: TempleAccount = {
        id: nanoid(),
        type: TempleAccountType.HD,
        name: accountToReplace?.name ?? (await fetchMessage('defaultAccountName', '1')),
        hdIndex: hdAccIndex,
        publicKeyHash: tezosAcc.address,
        walletId,
        isKYC: undefined
      };

      const newAccounts = concatAccount(allAccounts, newAccount);
      const newWalletsSpecs: StringRecord<WalletSpecs> = {
        ...walletsSpecs,
        [walletId]: { name: walletName, createdAt: Date.now() }
      };

      await encryptAndSaveMany(
        [
          [walletMnemonicStrgKey(walletId), mnemonic],
          ...buildEncryptAndSaveManyForAccount(tezosAcc),
          [accountsStrgKey, newAccounts]
        ],
        this.passKey
      );
      await savePlain<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY, newWalletsSpecs);

      return { newAccounts, newWalletsSpecs };
    });
  }

  async importAccount(chain: TempleChainKind, chainId: string, accPrivateKey: string, encPassword?: string) {
    const errMessage = 'Failed to import account.\nThis may happen because provided Key is invalid';

    return withError(errMessage, async () => {
      const signer = await createMemorySigner(accPrivateKey, encPassword);
      const [accPublicKeyHash] = await Promise.all([signer.publicKeyHash()]);
      const allAccounts = await this.fetchAccounts();
      const isKYC = await getKYCStatus(accPublicKeyHash, chainId);

      const accCreds = await privateKeyToTezosAccountCreds(accPrivateKey, encPassword);
      const newAccount: TempleAccount = {
        id: nanoid(),
        type: TempleAccountType.Imported,
        chain,
        name: await fetchNewAccountName(allAccounts, TempleAccountType.Imported),
        publicKeyHash: accCreds.address,
        isKYC
      };
      const newAllAccounts = concatAccount(allAccounts, newAccount);

      await encryptAndSaveMany(
        [...buildEncryptAndSaveManyForAccount(accCreds), [accountsStrgKey, newAllAccounts]],
        this.passKey
      );

      return newAllAccounts;
    });
  }

  async importMnemonicAccount(mnemonic: string, chainId: string, password?: string, derivationPath?: string) {
    return withError('Failed to import account', async () => {
      let seed;
      try {
        seed = Bip39.mnemonicToSeedSync(mnemonic, password);
      } catch (_err) {
        throw new PublicError('Invalid Mnemonic or Password');
      }

      if (derivationPath) {
        seed = deriveSeed(seed, derivationPath);
      }

      const chain = TempleChainKind.Tezos;

      const privateKey = seedToPrivateKey(seed);
      return this.importAccount(chain, chainId, privateKey);
    });
  }

  async importFundraiserAccount(email: string, password: string, mnemonic: string, chainId: string) {
    return withError('Failed to import fundraiser account', async () => {
      const seed = Bip39.mnemonicToSeedSync(mnemonic, `${email}${password}`);
      const privateKey = seedToPrivateKey(seed);
      return this.importAccount(TempleChainKind.Tezos, chainId, privateKey);
    });
  }

  async importManagedKTAccount(accPublicKeyHash: string, chainId: string, owner: string) {
    return withError('Failed to import Managed KT account', async () => {
      const allAccounts = await this.fetchAccounts();

      const isKYC = await getKYCStatus(accPublicKeyHash, chainId);
      const newAccount: TempleAccount = {
        id: nanoid(),
        type: TempleAccountType.ManagedKT,
        name: await fetchNewAccountName(
          allAccounts.filter(({ type }) => type === TempleAccountType.ManagedKT),
          TempleAccountType.ManagedKT,
          'defaultManagedKTAccountName'
        ),
        publicKeyHash: accPublicKeyHash,
        chainId,
        owner,
        isKYC
      };
      const newAllAcounts = concatAccount(allAccounts, newAccount);

      await encryptAndSaveMany([[accountsStrgKey, newAllAcounts]], this.passKey);

      return newAllAcounts;
    });
  }

  async importWatchOnlyAccount(chain: TempleChainKind, address: string, chainId?: string, name?: string) {
    return withError('Failed to import Watch Only account', async () => {
      const allAccounts = await this.fetchAccounts();

      const nametoPut = name
        ? name
        : await fetchNewAccountName(allAccounts, TempleAccountType.WatchOnly, undefined, 'defaultWatchOnlyAccountName');
      const newAccount: TempleAccount = {
        id: nanoid(),
        type: TempleAccountType.WatchOnly,
        name: nametoPut,
        publicKeyHash: address,
        chain,
        chainId,
        isKYC: false
      };
      const newAllAccounts = concatAccount(allAccounts, newAccount);

      await encryptAndSaveMany([[accountsStrgKey, newAllAccounts]], this.passKey);

      return newAllAccounts;
    });
  }

  async createLedgerAccount(input: SaveLedgerAccountInput) {
    return withError('Failed to create Ledger account', async () => {
      try {
        const allAccounts = await this.fetchAccounts();

        if (isNameCollision(allAccounts, TempleAccountType.Ledger, input.name)) {
          throw new PublicError(ACCOUNT_NAME_COLLISION_ERR_MSG);
        }

        const { publicKey, ...storedAccountProps } = input;
        const newAccount: TempleAccount = {
          id: nanoid(),
          type: TempleAccountType.Ledger,
          ...storedAccountProps
        };
        const newAllAccounts = concatAccount(allAccounts, newAccount);

        await encryptAndSaveMany(
          [
            [accPubKeyStrgKey(input.publicKeyHash), publicKey],
            [accountsStrgKey, newAllAccounts]
          ],
          this.passKey
        );

        return newAllAccounts;
      } catch (e: any) {
        throw new PublicError(e.message);
      }
    });
  }

  async editAccountName(accPublicKeyHash: string, name: string) {
    return withError('Failed to edit account name', async () => {
      const allAccounts = await this.fetchAccounts();
      if (!allAccounts.some(acc => acc.publicKeyHash === accPublicKeyHash)) {
        throw new PublicError('Account not found');
      }

      if (allAccounts.some(acc => acc.publicKeyHash !== accPublicKeyHash && acc.name === name)) {
        throw new PublicError('Account with same name already exist');
      }

      const newAllAcounts = allAccounts.map(acc => (acc.publicKeyHash === accPublicKeyHash ? { ...acc, name } : acc));
      await encryptAndSaveMany([[accountsStrgKey, newAllAcounts]], this.passKey);

      return newAllAcounts;
    });
  }

  async editGroupName(id: string, name: string) {
    return withError('Failed to edit group name', async () => {
      validateWalletName(name);

      const walletsSpecs = await this.fetchWalletsSpecs();

      if (!(id in walletsSpecs)) {
        throw new PublicError('Group not found');
      }

      if (
        Object.entries(walletsSpecs).some(
          ([walletId, { name: currentName }]) => walletId !== id && currentName === name
        )
      ) {
        throw new PublicError('Group with this name already exists');
      }

      const newWalletsSpecs: StringRecord<WalletSpecs> = {
        ...walletsSpecs,
        [id]: { name, createdAt: walletsSpecs[id].createdAt }
      };
      await savePlain<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY, newWalletsSpecs);

      return newWalletsSpecs;
    });
  }

  async updateAccountKYCStatus(accPublicKeyHash: string, isKYC: boolean) {
    return withError('Failed to update account KYC status', async () => {
      const allAccounts = await this.fetchAccounts();
      if (!allAccounts.some(acc => acc.publicKeyHash === accPublicKeyHash)) {
        throw new PublicError('Account not found');
      }

      const newAllAcounts = allAccounts.map(acc =>
        acc.publicKeyHash === accPublicKeyHash ? { ...acc, isKYC: isKYC } : acc
      );

      await encryptAndSaveMany([[accountsStrgKey, newAllAcounts]], this.passKey);

      return newAllAcounts;
    });
  }

  async updateSettings(settings: Partial<TempleSettings>) {
    return withError('Failed to update settings', async () => {
      const current = await this.fetchSettings();
      const newSettings = { ...current, ...settings };
      await encryptAndSaveMany([[settingsStrgKey, newSettings]], this.passKey);
      return newSettings;
    });
  }

  async sign(accPublicKeyHash: string, bytes: string, watermark?: string) {
    return withError('Failed to sign', () =>
      this.withSigner(accPublicKeyHash, async signer => {
        const watermarkBuf = watermark ? WebMavrykUtils.hex2buf(watermark) : undefined;
        return signer.sign(bytes, watermarkBuf);
      })
    );
  }

  async sendOperations(accPublicKeyHash: string, rpc: string, opParams: any[]) {
    return this.withSigner(accPublicKeyHash, async signer => {
      const batch = await withError('Failed to send operations', async () => {
        const tezos = new MavrykToolkit(loadFastRpcClient(rpc));
        tezos.setSignerProvider(signer);
        tezos.setForgerProvider(new CompositeForger([tezos.getFactory(RpcForger)(), localForger]));
        tezos.setPackerProvider(michelEncoder);
        return tezos.contract.batch(opParams.map(formatOpParamsBeforeSend));
      });

      try {
        return await batch.send();
      } catch (err: any) {
        console.error('Operation send failed:', err.message);

        switch (true) {
          case err instanceof PublicError:
          case err instanceof MavrykOperationError:
            throw err;

          case err instanceof HttpResponseError:
            throw await transformHttpResponseError(err);

          default:
            throw new Error(`Failed to send operations. ${err.message}`);
        }
      }
    });
  }

  private async withSigner<T>(accPublicKeyHash: string, factory: (signer: Signer) => Promise<T>) {
    const { signer, cleanup } = await this.getSigner(accPublicKeyHash);
    try {
      return await factory(signer);
    } finally {
      cleanup();
    }
  }

  private async getSigner(accPublicKeyHash: string): Promise<{ signer: Signer; cleanup: () => void }> {
    const allAccounts = await this.fetchAccounts();
    const acc = allAccounts.find(a => a.publicKeyHash === accPublicKeyHash);
    if (!acc) {
      throw new PublicError('Account not found');
    }

    switch (acc.type) {
      case TempleAccountType.Ledger:
        const publicKey = await this.revealPublicKey(accPublicKeyHash);
        return await createLedgerSigner(acc.derivationPath, acc.derivationType, publicKey, accPublicKeyHash);

      case TempleAccountType.WatchOnly:
        throw new PublicError('Cannot sign Watch-only account');

      default:
        const privateKey = await fetchAndDecryptOne<string>(accPrivKeyStrgKey(accPublicKeyHash), this.passKey);
        const signer = await createMemorySigner(privateKey);
        return { signer, cleanup: () => {} };
    }
  }
}
