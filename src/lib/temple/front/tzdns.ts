import { useMemo } from 'react';

import { DomainNameValidationResult, isMavrykDomainsSupportedNetwork } from '@mavrykdynamics/mavryk-domains-core';
import { WebmavrykMavrykDomainsClient } from '@mavrykdynamics/mavryk-domains-webmavryk-client';
import { MavrykToolkit } from '@mavrykdynamics/webmavryk';
import { useQuery } from '@tanstack/react-query';

import { NETWORK_IDS } from 'lib/temple/networks';

import { useTezos, useChainId } from './ready';

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
  const tezos = useTezos();

  const networkId = NETWORK_IDS.get(chainId)!;
  return useMemo(() => getClient(networkId === 'mainnet' ? networkId : 'custom', tezos), [networkId, tezos]);
}

export function useTezosAddressByDomainName(domainName: string) {
  const domainsClient = useTezosDomainsClient();
  const tezos = useTezos();

  return useQuery({
    queryKey: ['tzdns-address', tezos.checksum, domainName],
    queryFn: () => domainsClient.resolver.resolveNameToAddress(domainName),
    retry: false,
    refetchOnWindowFocus: false
  });
}

export function useTezosDomainNameByAddress(address: string) {
  const { resolver: domainsResolver } = useTezosDomainsClient();
  const tezos = useTezos();

  return useQuery({
    queryKey: ['tzdns-reverse-name', address, tezos.checksum],
    queryFn: () => domainsResolver.resolveAddressToName(address),
    retry: false,
    refetchOnWindowFocus: false
  });
}
