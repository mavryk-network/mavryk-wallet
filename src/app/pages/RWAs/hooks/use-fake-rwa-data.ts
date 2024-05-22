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
          asset === 'KT19S7YeHEnKaBysuGuTBq4QgmxEZNptvBJS_0' || asset === 'KT1RH2fB6bANvSGPKHsBdzSVA4ef7PSQWn2A_0'
      ),
    [filteredAssets]
  );
};
