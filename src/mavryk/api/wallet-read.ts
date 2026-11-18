import type { MavrykApiRequestConfig } from './client';
import { getWalletReadAccessForAccount } from './storage';

export type WalletReadResource = 'assets' | 'tokens';

/**
 * Route and request config for a wallet-scoped read of `address`: its own session on `/wallets/{address}/*`, or the
 * credential-free `/watch-only/wallets/{address}/*` route (same response schema) for an account that cannot sign in.
 */
export async function getWalletReadRequest(
  address: string,
  resource: WalletReadResource
): Promise<{ url: string; config: MavrykApiRequestConfig }> {
  const access = await getWalletReadAccessForAccount(address);

  return access.kind === 'public'
    ? {
        url: `/watch-only/wallets/${encodeURIComponent(address)}/${resource}`,
        config: { publicRead: { networkId: access.networkId } }
      }
    : { url: `/wallets/${address}/${resource}`, config: { _authContext: access.authContext } };
}
