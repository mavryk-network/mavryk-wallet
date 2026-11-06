import { useAccount, useChainId, useNetwork } from 'lib/temple/front';
import { normalizeNetworkId } from 'lib/temple/network-storage';

import { DetailScope } from './details.types';

/** Only mounted beneath the existing ready-account gate; a resolving chain remains disabled. */
export const useDetailScope = (): DetailScope => ({
  account: useAccount().publicKeyHash,
  chainId: useChainId() ?? '',
  networkId: normalizeNetworkId(useNetwork().id)
});
