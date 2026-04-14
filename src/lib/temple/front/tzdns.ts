import { useMemo } from 'react';

import { DomainNameValidationResult, isMavrykDomainsSupportedNetwork } from '@mavrykdynamics/mavryk-domains-core';
import { WebmavrykMavrykDomainsClient } from '@mavrykdynamics/mavryk-domains-webmavryk-client';
import { MavrykToolkit } from '@mavrykdynamics/webmavryk';
import { useQuery } from '@tanstack/react-query';

import { tzdnsKeys } from 'lib/query-keys';
import { NETWORK_IDS } from 'lib/temple/networks';

import { useMavryk, useChainId } from './ready';

function getClient(networkId: 'mainnet' | 'custom', tezos: MavrykToolkit) {
  return isMavrykDomainsSupportedNetwork(networkId)
    ? new WebmavrykMavrykDomainsClient({ network: networkId, mavryk: tezos })
    : WebmavrykMavrykDomainsClient.Unsupported;
}

export function isDomainNameValid(name: string, client: WebmavrykMavrykDomainsClient) {
  return client.validator.validateDomainName(name, { minLevel: 2 }) === DomainNameValidationResult.VALID;
}

export function useTezosDomainsClient() {
  const chainId = useChainId(true)!;
  const mavryk = useMavryk();

  const networkId = NETWORK_IDS.get(chainId)!;
  return useMemo(() => getClient(networkId === 'mainnet' ? networkId : 'custom', mavryk), [networkId, mavryk]);
}

export function useTezosAddressByDomainName(domainName: string) {
  const domainsClient = useTezosDomainsClient();
  const mavryk = useMavryk();

  return useQuery({
    queryKey: tzdnsKeys.address(mavryk.checksum, domainName),
    queryFn: () => domainsClient.resolver.resolveNameToAddress(domainName),
    retry: false,
    refetchOnWindowFocus: false
  });
}

export function useTezosDomainNameByAddress(address: string) {
  const { resolver: domainsResolver } = useTezosDomainsClient();
  const mavryk = useMavryk();

  return useQuery({
    queryKey: tzdnsKeys.reverseName(address, mavryk.checksum),
    queryFn: () => domainsResolver.resolveAddressToName(address),
    retry: false,
    refetchOnWindowFocus: false
  });
}
