import { useMemo } from 'react';

import { useAccountTokensSelector } from 'app/store/assets/selectors';
import { useTokensMetadataPresenceCheck } from 'lib/metadata';
import { useAccount, useChainId } from 'lib/temple/front';

export const useMetadataLoading = () => {
  const chainId = useChainId(true)!;
  const { publicKeyHash: account } = useAccount();

  const tokens = useAccountTokensSelector(account, chainId);
  const slugs = useMemo(() => Object.keys(tokens ?? {}), [tokens]);

  useTokensMetadataPresenceCheck(slugs);
};
