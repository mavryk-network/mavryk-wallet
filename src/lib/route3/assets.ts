import { useMemo } from 'react';

import { toTokenSlug } from 'lib/assets';
import { useSwapTokensData } from 'lib/swap/use-swap.query';

import { isRoute3GasToken } from './utils/assets.utils';

export const useAvailableRoute3TokensSlugs = () => {
  const { data: route3tokens, isLoading } = useSwapTokensData();

  const route3tokensSlugs = useMemo(
    () =>
      route3tokens.reduce<string[]>((acc, { contract, tokenId }) => {
        if (isRoute3GasToken(contract)) return acc;

        return acc.concat(toTokenSlug(contract, tokenId ?? 0));
      }, []),
    [route3tokens]
  );

  return {
    isLoading,
    route3tokensSlugs
  };
};
