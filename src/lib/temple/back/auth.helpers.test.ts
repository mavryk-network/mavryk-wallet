import { buildAuthWalletAddressesMap, resolveAuthWalletAddress } from 'lib/temple/helpers';
import { TempleAccountType, TempleChainKind, type TempleAccount } from 'lib/temple/types';

import { shouldPerformInteractiveAuthChallenge } from './auth.helpers';

const ledgerAccount: TempleAccount = {
  id: 'ledger-1',
  type: TempleAccountType.Ledger,
  name: 'Ledger',
  publicKeyHash: 'mv1-ledger',
  chain: TempleChainKind.Tezos,
  derivationPath: "44'/1969'/0'/0'",
  isKYC: undefined
};

const importedAccount: TempleAccount = {
  id: 'imported-1',
  type: TempleAccountType.Imported,
  name: 'Imported',
  publicKeyHash: 'mv1-imported',
  chain: TempleChainKind.Tezos,
  isKYC: undefined
};

const watchOnlyAccount: TempleAccount = {
  id: 'watch-1',
  type: TempleAccountType.WatchOnly,
  name: 'Watch only',
  publicKeyHash: 'mv1-watch-only',
  chain: TempleChainKind.Tezos,
  isKYC: undefined
};

const hdAccount = (hdIndex: number): TempleAccount => ({
  id: `hd-${hdIndex}`,
  type: TempleAccountType.HD,
  name: `Account ${hdIndex + 1}`,
  publicKeyHash: `mv1-hd-${hdIndex}`,
  hdIndex,
  walletId: 'wallet-a',
  isKYC: undefined
});

describe('auth wallet mapping', () => {
  it('signs every HD sub-account in as itself, not as the index-0 account', () => {
    // The Wallet API answers 403 "not linked" when a sibling's session reads /wallets/{sub-account}/*.
    const accounts = [hdAccount(0), hdAccount(1), importedAccount];

    expect(resolveAuthWalletAddress(accounts, 'mv1-hd-1')).toBe('mv1-hd-1');
    expect(buildAuthWalletAddressesMap(accounts)).toEqual({
      'mv1-hd-0': 'mv1-hd-0',
      'mv1-hd-1': 'mv1-hd-1',
      'mv1-imported': 'mv1-imported'
    });
  });

  it('maps accounts that cannot sign in to the first signable account', () => {
    expect(buildAuthWalletAddressesMap([watchOnlyAccount, hdAccount(1), hdAccount(0)])).toEqual({
      'mv1-watch-only': 'mv1-hd-1',
      'mv1-hd-1': 'mv1-hd-1',
      'mv1-hd-0': 'mv1-hd-0'
    });
  });
});

describe('auth.helpers', () => {
  it('allows interactive auth for Ledger accounts', () => {
    expect(shouldPerformInteractiveAuthChallenge([ledgerAccount], ledgerAccount.publicKeyHash, true)).toBe(true);
  });

  it('skips passive auth challenge for Ledger accounts', () => {
    expect(shouldPerformInteractiveAuthChallenge([ledgerAccount], ledgerAccount.publicKeyHash, false)).toBe(false);
  });

  it('keeps passive auth challenge enabled for non-Ledger accounts', () => {
    expect(shouldPerformInteractiveAuthChallenge([importedAccount], importedAccount.publicKeyHash, false)).toBe(true);
  });

  it('skips passive auth challenge when a watch-only account resolves to a Ledger auth wallet', () => {
    expect(
      shouldPerformInteractiveAuthChallenge([watchOnlyAccount, ledgerAccount], watchOnlyAccount.publicKeyHash, false)
    ).toBe(false);
  });
});
