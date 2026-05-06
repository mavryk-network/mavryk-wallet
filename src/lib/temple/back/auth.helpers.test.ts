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
