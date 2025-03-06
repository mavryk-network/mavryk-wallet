import { isEqual } from 'lodash';

import { dispatch } from 'app/store';
import { loadRwasDetailsActions } from 'app/store/rwas/actions';
import { useAccountRwas } from 'lib/assets/hooks/rwas';
import { RWAS_DETAILS_SYNC_INTERVAL } from 'lib/fixed-times';
import { useAccount, useChainId } from 'lib/temple/front';
import { useInterval, useMemoWithCompare } from 'lib/ui/hooks';

export const useRWAsDetailsLoading = () => {
  const chainId = useChainId()!;
  const { publicKeyHash } = useAccount();
  const rwas = useAccountRwas(publicKeyHash, chainId);

  const slugs = useMemoWithCompare(() => rwas.map(({ slug }) => slug).sort(), [rwas], isEqual);

  useInterval(
    () => {
      // Is it necessary for collectibles on non-Mainnet networks too?
      if (slugs.length) dispatch(loadRwasDetailsActions.submit(slugs));
    },
    RWAS_DETAILS_SYNC_INTERVAL,
    [slugs]
  );
};
