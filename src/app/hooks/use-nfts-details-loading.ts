import { isEqual } from 'lodash';
import { useDispatch } from 'react-redux';

import { loadNFTsDetailsActions } from 'app/store/nfts/actions';
import { NFTS_DETAILS_SYNC_INTERVAL } from 'lib/fixed-times';
import { useAccount, useChainId, useNFTTokens } from 'lib/temple/front';
import { useInterval, useMemoWithCompare } from 'lib/ui/hooks';

export const useNFTssDetailsLoading = () => {
  const chainId = useChainId()!;
  const { publicKeyHash } = useAccount();
  const { data: nfts } = useNFTTokens(chainId, publicKeyHash);
  const dispatch = useDispatch();

  const slugs = useMemoWithCompare(() => nfts.map(({ tokenSlug }) => tokenSlug).sort(), [nfts], isEqual);

  useInterval(
    () => {
      if (slugs.length < 1) return;

      dispatch(loadNFTsDetailsActions.submit(slugs));
    },
    NFTS_DETAILS_SYNC_INTERVAL,
    [slugs, dispatch]
  );
};
