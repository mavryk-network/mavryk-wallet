import { useAssetsQuery } from 'lib/assets/use-assets-query';
import { useSecurityQuery } from 'lib/assets/use-security-query';
import { useChainId } from 'lib/temple/front';

/** Mount request drivers under the existing owner/account readiness boundary. */
export const useAssetsLoading = () => {
  useSecurityQuery(useChainId() ?? '');
  useAssetsQuery('tokens');
  useAssetsQuery('collectibles');
  useAssetsQuery('rwas');
};
