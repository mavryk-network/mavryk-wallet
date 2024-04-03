import { useCallback, useMemo } from 'react';

import { DomainNameValidationResult, isMavrykDomainsSupportedNetwork } from '@mavrykdynamics/mavryk-domains-core';
import { TaquitoMavrykDomainsClient } from '@mavrykdynamics/mavryk-domains-taquito-client';
import { TezosToolkit } from '@mavrykdynamics/taquito';

import { useTypedSWR } from 'lib/swr';
import { NETWORK_IDS } from 'lib/temple/networks';

import { useTezos, useChainId } from './ready';

function getClient(networkId: 'mainnet' | 'custom', tezos: TezosToolkit) {
  return isMavrykDomainsSupportedNetwork(networkId)
    ? new TaquitoMavrykDomainsClient({ network: networkId, tezos })
    : TaquitoMavrykDomainsClient.Unsupported;
}

export function isDomainNameValid(name: string, client: TaquitoMavrykDomainsClient) {
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

  const domainAddressFactory = useCallback(
    ([, , name]: [string, string, string]) => domainsClient.resolver.resolveNameToAddress(name),
    [domainsClient]
  );

  return useTypedSWR(['tzdns-address', tezos.checksum, domainName], domainAddressFactory, {
    shouldRetryOnError: false,
    revalidateOnFocus: false
  });
}

export function useTezosDomainNameByAddress(address: string) {
  const { resolver: domainsResolver } = useTezosDomainsClient();
  const tezos = useTezos();
  const resolveDomainReverseName = useCallback(
    ([, pkh]: [string, string, string]) => domainsResolver.resolveAddressToName(pkh),
    [domainsResolver]
  );

  return useTypedSWR(['tzdns-reverse-name', address, tezos.checksum], resolveDomainReverseName, {
    shouldRetryOnError: false,
    revalidateOnFocus: false
  });
}
