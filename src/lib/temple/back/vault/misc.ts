import { InMemorySigner } from '@mavrykdynamics/taquito-signer';
import * as TaquitoUtils from '@mavrykdynamics/taquito-utils';
import * as Bip39 from 'bip39';
import * as Ed25519 from 'ed25519-hd-key';

import { KYC_CONTRACT } from 'lib/route3/constants';
import { TempleAccount } from 'lib/temple/types';

import { PublicError } from '../PublicError';

import { fetchMessage } from './helpers';

const TEZOS_BIP44_COINTYPE = 1729;

export function generateCheck() {
  return Bip39.generateMnemonic(128);
}

export function concatAccount(current: TempleAccount[], newOne: TempleAccount) {
  if (current.every(a => a.publicKeyHash !== newOne.publicKeyHash)) {
    return [...current, newOne];
  }

  throw new PublicError('Account already exists');
}

type NewAccountName = 'defaultAccountName' | 'defaultManagedKTAccountName' | 'defaultWatchOnlyAccountName';

export function fetchNewAccountName(
  allAccounts: TempleAccount[],
  templateI18nKey: NewAccountName = 'defaultAccountName'
) {
  return fetchMessage(templateI18nKey, String(allAccounts.length + 1));
}

export async function getPublicKeyAndHash(privateKey: string) {
  const signer = await createMemorySigner(privateKey);
  return Promise.all([signer.publicKey(), signer.publicKeyHash()]);
}

// TODO change later with networks
export async function getKYCStatus(pkh: string, apiUrl = 'https://atlasnet.api.mavryk.network') {
  try {
    // TODO ad chain data
    const storageRes: any = await fetch(`${apiUrl}/v1/contracts/${KYC_CONTRACT}/storage/`);
    const bigMapId = (await storageRes.json()).memberLedger;

    const contractData = await fetch(`${apiUrl}/v1/bigmaps/${bigMapId}/keys/${pkh}`);

    // if no data than no KYCed user
    if (contractData.status === 204) return false;

    const isKYCAddress = await contractData.json();

    return Boolean(isKYCAddress);
  } catch (e) {
    console.log(e);
    return false;
  }
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
  return TaquitoUtils.b58cencode(seed.slice(0, 32), TaquitoUtils.prefix.edsk2);
}

export function deriveSeed(seed: Buffer, derivationPath: string) {
  try {
    const { key } = Ed25519.derivePath(derivationPath, seed.toString('hex'));
    return key;
  } catch (_err) {
    throw new PublicError('Invalid derivation path');
  }
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
