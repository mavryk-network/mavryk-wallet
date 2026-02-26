import { useEffect, useMemo } from 'react';

import { useAccountTokensSelector } from 'lib/store/zustand/assets.store';
import { useTokensMetadataPresenceCheck } from 'lib/metadata';
import { metadataStore } from 'lib/store/zustand/metadata.store';
import { useAccount, useChainId } from 'lib/temple/front';

export const useMetadataLoading = () => {
  const chainId = useChainId(true)!;
  const { publicKeyHash: account } = useAccount();

  const tokens = useAccountTokensSelector(account, chainId);
  const slugs = useMemo(() => Object.keys(tokens), [tokens]);

  useEffect(() => {
    metadataStore.getState().setTokensMetadataLoading(false);

    return () => void metadataStore.getState().setTokensMetadataLoading(false);
  }, []);

  // TODO: Should there be a time interval?
  useTokensMetadataPresenceCheck(slugs);
};
