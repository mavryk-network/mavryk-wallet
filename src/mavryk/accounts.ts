import { TempleAccount, TempleAccountType, TempleAccountBase, TempleChainKind } from 'lib/temple/types';

export const isAccountOfActableType = (account: TempleAccountBase) =>
  !(account.type === TempleAccountType.WatchOnly || account.type === TempleAccountType.ManagedKT);

export interface AccountForChain<C extends TempleChainKind = TempleChainKind> {
  id: string;
  chain: C;
  publicKeyHash: string;
  type: TempleAccountType;
  name: string;
  /** Present for `AccountForChain.type === TempleAccountType.Ledger` */
  derivationPath?: string;
  hidden?: boolean;
  /** Present for `AccountForChain.type === TempleAccountType.ManagedKT` */
  ownerAddress?: string;
}

export type AccountForTezos = AccountForChain<TempleChainKind.Tezos>;

export const getAccountForTezos = (account: TempleAccount) => getAccountForChain(account, TempleChainKind.Tezos);

function getAccountForChain<C extends TempleChainKind>(account: TempleAccount, chain: C): AccountForChain<C> | null {
  const { id, type, name, derivationPath, hidden } = account;
  let publicKeyHash: string | undefined, ownerAddress: string | undefined;

  switch (account.type) {
    case TempleAccountType.HD:
      publicKeyHash = account[`${chain}Address`];
      break;
    case TempleAccountType.Imported:
    case TempleAccountType.WatchOnly:
    case TempleAccountType.Ledger:
      if (account.chain === chain) publicKeyHash = account.publicKeyHash;
      break;
    case TempleAccountType.ManagedKT:
      publicKeyHash = account.publicKeyHash;
      ownerAddress = account.owner;
      break;
  }

  if (!publicKeyHash) return null;

  return { id, publicKeyHash, chain, type, name, derivationPath, hidden, ownerAddress };
}

export const getAccountAddressForTezos = (account: TempleAccount) =>
  getAccountAddressForChain(account, TempleChainKind.Tezos);

export const getAccountAddressForChain = (account: TempleAccount, chain: TempleChainKind): string | undefined => {
  switch (account.type) {
    case TempleAccountType.HD:
      return account[`${chain}Address`];
    case TempleAccountType.Imported:
    case TempleAccountType.WatchOnly:
    case TempleAccountType.Ledger:
      return account.chain === chain ? account.publicKeyHash : undefined;
    default:
      return account.publicKeyHash;
  }
};

export function findAccountForTezos(accounts: TempleAccount[], address: string) {
  for (const account of accounts) {
    const tezosAccount = getAccountForTezos(account);
    if (tezosAccount && tezosAccount.publicKeyHash === address) return tezosAccount;
  }

  return undefined;
}
