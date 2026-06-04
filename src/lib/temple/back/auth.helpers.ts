import { resolveAuthWalletAddress } from 'lib/temple/helpers';
import { TempleAccount, TempleAccountType } from 'lib/temple/types';

/**
 * Passive auth flows must never fall back to Ledger signing.
 */
export const shouldPerformInteractiveAuthChallenge = (
  allAccounts: TempleAccount[],
  accountPublicKeyHash?: string | null,
  interactive = true
) => {
  if (interactive) return true;

  const authWalletAddress = resolveAuthWalletAddress(allAccounts, accountPublicKeyHash);
  if (!authWalletAddress) return false;

  return allAccounts.find(account => account.publicKeyHash === authWalletAddress)?.type !== TempleAccountType.Ledger;
};
