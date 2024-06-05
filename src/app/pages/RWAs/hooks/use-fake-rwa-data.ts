import { useMemo } from 'react';

import { useTokensListingLogic } from 'app/hooks/use-tokens-listing-logic';
import { useEnabledAccountTokensSlugs } from 'lib/assets/hooks';

export const useFakeRwaData = () => {
  const slugs = useEnabledAccountTokensSlugs();
  const { filteredAssets } = useTokensListingLogic(slugs, false);

  return useMemo(
    () =>
      filteredAssets.filter(
        asset =>
          asset === 'KT1J1p1f1owAEjJigKGXhwzu3tVCvRPVgGCh_0' || asset === 'KT1CgLvrzj5MziwPWWzPkZj1eDeEpRAsYvQ9_0'
      ),
    [filteredAssets]
  );
};
