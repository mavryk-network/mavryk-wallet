import { useQuery } from '@tanstack/react-query';

import { fetchApyFromYupana } from 'lib/apis/yupana';
import { KNOWN_TOKENS_SLUGS } from 'lib/assets/known-tokens';
import { tokensKeys } from 'lib/query-keys';
import { useChainId } from 'lib/temple/front';
import { TempleChainId } from 'lib/temple/types';

const fetchAllTokensApy = async (): Promise<Record<string, number>> => {
  const [tzbtc, kusd, usdt] = await Promise.all([
    fetchApyFromYupana('TZBTC'),
    fetchApyFromYupana('KUSD'),
    fetchApyFromYupana('USDT')
  ]);

  return {
    [KNOWN_TOKENS_SLUGS.TZBTC]: tzbtc,
    [KNOWN_TOKENS_SLUGS.KUSD]: kusd,
    [KNOWN_TOKENS_SLUGS.USDT]: usdt
  };
};

export const useTokensApyQuery = () => {
  const chainId = useChainId(true);
  const isMainnet = chainId === TempleChainId.Mainnet;

  return useQuery({
    queryKey: tokensKeys.apy,
    queryFn: fetchAllTokensApy,
    enabled: isMainnet,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false
  });
};

export const useTokensApyRates = (): Record<string, number> => {
  const { data } = useTokensApyQuery();
  return data ?? {};
};
