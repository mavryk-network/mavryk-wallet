import { InMemorySigner } from '@mavrykdynamics/webmavryk-signer';
import * as TaquitoUtils from '@mavrykdynamics/webmavryk-utils';
import { isDefined } from '@rnw-community/shared';
import * as Bip39 from 'bip39';
import * as Ed25519 from 'ed25519-hd-key';

import { fetchNewAccountName as genericFetchNewAccountName } from 'lib/temple/helpers';
import { TempleAccount, TempleAccountType } from 'lib/temple/types';

import { PublicError } from '../PublicError';

import { fetchMessage } from './helpers';
import { accPrivKeyStrgKey, accPubKeyStrgKey } from './storage-keys';

const TEZOS_BIP44_COINTYPE = 1729;

type NewAccountName = 'defaultAccountName' | 'defaultManagedKTAccountName' | 'defaultWatchOnlyAccountName';

interface AccountCreds {
  address: string;
  publicKey: string;
  privateKey: string;
}

export function generateCheck() {
  return Bip39.generateMnemonic(128);
}

export function concatAccount(current: TempleAccount[], newOne: TempleAccount) {
  if (current.every(a => a.publicKeyHash !== newOne.publicKeyHash)) {
    return [...current, newOne];
  }

  throw new PublicError('Account already exists');
}

export async function fetchNewAccountName(
  allAccounts: TempleAccount[],
  newAccountType: TempleAccountType,
  newAccountGroupId?: string,
  templateI18nKey: NewAccountName = 'defaultAccountName'
) {
  return genericFetchNewAccountName(
    allAccounts,
    newAccountType,
    i => fetchMessage(templateI18nKey, String(i)),
    newAccountGroupId
  );
}
export async function getPublicKeyAndHash(privateKey: string) {
  const signer = await createMemorySigner(privateKey);
  return Promise.all([signer.publicKey(), signer.publicKeyHash()]);
}

export async function createMemorySigner(privateKey: string, encPassword?: string) {
  return InMemorySigner.fromSecretKey(privateKey, encPassword);
}

export function seedToHDPrivateKey(seed: Buffer, hdAccIndex: number) {
  return seedToPrivateKey(deriveSeed(seed, getMainDerivationPath(hdAccIndex)));
}

export function getMainDerivationPath(accIndex: number) {
  return `m/44'/${TEZOS_BIP44_COINTYPE}'/${accIndex}'/0'`;
}

export function seedToPrivateKey(seed: Buffer) {
  return TaquitoUtils.b58cencode(new Uint8Array(seed.slice(0, 32)), TaquitoUtils.prefix.edsk2);
}

export function deriveSeed(seed: Buffer, derivationPath: string) {
  try {
    const { key } = Ed25519.derivePath(derivationPath, seed.toString('hex'));
    return key;
  } catch (_err) {
    throw new PublicError('Invalid derivation path');
  }
}

export async function mnemonicToTezosAccountCreds(mnemonic: string, hdIndex: number): Promise<AccountCreds> {
  const seed = Bip39.mnemonicToSeedSync(mnemonic);
  const privateKey = seedToHDPrivateKey(seed, hdIndex);

  const signer = await createMemorySigner(privateKey);
  const [publicKey, address] = await Promise.all([signer.publicKey(), signer.publicKeyHash()]);

  return { address, publicKey, privateKey };
}

export async function privateKeyToTezosAccountCreds(
  accPrivateKey: string,
  encPassword?: string
): Promise<AccountCreds> {
  const signer = await createMemorySigner(accPrivateKey, encPassword);

  const [realAccPrivateKey, publicKey, address] = await Promise.all([
    isDefined(encPassword) ? signer.secretKey() : Promise.resolve(accPrivateKey),
    signer.publicKey(),
    signer.publicKeyHash()
  ]);

  return { address, publicKey, privateKey: realAccPrivateKey };
}

export function canRemoveAccounts(allAccounts: TempleAccount[], accountsToRemove: TempleAccount[]) {
  const allHdAccounts = allAccounts.filter(acc => acc.type === TempleAccountType.HD);
  const hdAccountsToRemove = accountsToRemove.filter(acc => acc.type === TempleAccountType.HD);

  return allHdAccounts.length - hdAccountsToRemove.length >= 1;
}

export async function withError<T>(errMessage: string, factory: (doThrow: () => void) => Promise<T>) {
  try {
    return await factory(() => {
      throw new Error('<stub>');
    });
  } catch (err: any) {
    console.error(err);
    throw err instanceof PublicError ? err : new PublicError(errMessage);
  }
}

export const buildEncryptAndSaveManyForAccount = ({
  address,
  privateKey,
  publicKey
}: AccountCreds): [string, string][] => [
  [accPrivKeyStrgKey(address), privateKey],
  [accPubKeyStrgKey(address), publicKey]
];
