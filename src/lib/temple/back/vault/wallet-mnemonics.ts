import { WALLETS_SPECS_STORAGE_KEY } from 'lib/constants';
import { getSameGroupAccounts } from 'lib/temple/helpers';
import { TempleAccount, TempleAccountType, WalletSpecs } from 'lib/temple/types';

import { fetchAndDecryptOne, getPlain, removeMany } from './safe-storage';
import { accountsStrgKey, walletMnemonicStrgKey } from './storage-keys';

const fetchWalletsSpecs = async () => (await getPlain<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY)) ?? {};

/** Decrypts an HD wallet's seed phrase, refusing a removed wallet so a seed phrase left behind is never revealed */
export async function fetchWalletMnemonic(walletId: string, passKey: CryptoKey) {
  if (!(walletId in (await fetchWalletsSpecs()))) {
    throw new Error('Unknown HD wallet');
  }

  return fetchAndDecryptOne<string>(walletMnemonicStrgKey(walletId), passKey);
}

/** The sync payload data: the first HD wallet's seed phrase and the number of accounts derived from it */
export async function fetchSyncPayloadData(passKey: CryptoKey) {
  const [walletId] = Object.keys(await fetchWalletsSpecs());

  if (!walletId) {
    throw new Error('No HD wallet');
  }

  const [mnemonic, allAccounts] = await Promise.all([
    fetchAndDecryptOne<string>(walletMnemonicStrgKey(walletId), passKey),
    fetchAndDecryptOne<TempleAccount[]>(accountsStrgKey, passKey)
  ]);

  return [mnemonic, getSameGroupAccounts(allAccounts, TempleAccountType.HD, walletId).length];
}

/** Removes an HD wallet's seed phrase once no wallet spec refers to that wallet any more */
export async function removeOrphanedWalletMnemonic(walletId: string, walletsSpecs: StringRecord<WalletSpecs>) {
  if (!(walletId in walletsSpecs)) {
    await removeMany([walletMnemonicStrgKey(walletId)]);
  }
}
