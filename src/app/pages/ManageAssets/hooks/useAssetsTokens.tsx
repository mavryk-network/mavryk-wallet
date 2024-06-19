import { AssetsType } from 'app/store/assets/selectors';
import { useAccountCollectibles } from 'lib/assets/hooks';
import { useAccountRwas } from 'lib/assets/hooks/rwas';
import { useAccountTokens } from 'lib/assets/hooks/tokens';

export const useAssetsTokens = (type: AssetsType, address: string, chainId: string, returnRemovedTokes = false) => {
  const tokens = useAccountTokens(address, chainId, returnRemovedTokes);
  const collectibles = useAccountCollectibles(address, chainId);
  const rwas = useAccountRwas(address, chainId);

  switch (type) {
    case 'collectibles':
      return collectibles;
    case 'rwas':
      return rwas;
    case 'tokens':
      return tokens;
    default:
      return tokens;
  }
};
