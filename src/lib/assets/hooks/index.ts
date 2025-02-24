import { useMemo } from 'react';

import { MAVEN_METADATA, FILM_METADATA } from 'lib/metadata/defaults';
import { useChainIdLoading, useNetwork } from 'lib/temple/front';

import { MAV_TOKEN_SLUG } from '../utils';

export { useAllAvailableTokens, useEnabledAccountTokensSlugs } from './tokens';
export { useAccountCollectibles, useEnabledAccountCollectiblesSlugs } from './collectibles';

const KNOWN_DCP_CHAIN_IDS = ['NetXooyhiru73tk', 'NetXX7Tz1sK8JTa'];

export const useGasToken = (networkRpc?: string) => {
  const { type: defaultNetworkType, rpcBaseURL } = useNetwork();
  const suspense = Boolean(networkRpc) && networkRpc !== rpcBaseURL;
  const { data: chainId } = useChainIdLoading(networkRpc ?? rpcBaseURL, suspense);

  const isDcpNetwork = useMemo(
    () => (suspense ? KNOWN_DCP_CHAIN_IDS.includes(chainId!) : defaultNetworkType === 'dcp'),
    [chainId, suspense, defaultNetworkType]
  );

  return useMemo(
    () =>
      isDcpNetwork
        ? {
            logo: 'misc/token-logos/film.png',
            symbol: 'ф',
            assetName: 'FILM',
            metadata: FILM_METADATA,
            isDcpNetwork: true
          }
        : {
            logo: 'misc/token-logos/mvrk.png',
            symbol: 'ṁ',
            assetName: MAV_TOKEN_SLUG,
            metadata: MAVEN_METADATA
          },
    [isDcpNetwork]
  );
};
