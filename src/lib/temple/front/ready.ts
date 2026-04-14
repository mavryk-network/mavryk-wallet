import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { MavrykToolkit } from '@mavrykdynamics/webmavryk';
import { RpcClientInterface } from '@mavrykdynamics/webmavryk-rpc';
import { Tzip16Module } from '@mavrykdynamics/webmavryk-tzip16';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import constate from 'constate';

import { getKYCStatus } from 'lib/apis/mvkt/api';
import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';
import { IS_DEV_ENV } from 'lib/env';
import { chainKeys } from 'lib/query-keys';
import { loadChainId, michelEncoder, loadFastRpcClient } from 'lib/temple/helpers';
import {
  TempleAccountType,
  TempleStatus,
  TempleNotification,
  TempleMessageType
} from 'lib/temple/types';
import {
  useWalletNetworks,
  useWalletAccounts,
  useWalletSettings,
  useWalletsSpecs,
  useWalletStatus
} from 'lib/store/zustand/wallet.store';

import { intercom } from './client';
import { useMavrykClient } from './use-mavryk-client';
import { usePassiveStorage } from './storage';

// Chain IDs are immutable blockchain constants set at genesis — safe to cache for the full session.
const CHAIN_ID_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const [
  ReadyTempleProvider,
  useAllNetworks,
  useSetNetworkId,
  useNetwork,
  useAllAccounts,
  useSetAccountPkh,
  useAccount,
  useAccountPkh,
  useSettings,
  useHDGroups,
  useTezos
] = constate(
  useReadyTemple,
  v => v.allNetworks,
  v => v.setNetworkId,
  v => v.network,
  v => v.allAccounts,
  v => v.setAccountPkh,
  v => v.account,
  v => v.accountPkh,
  v => v.settings,
  v => v.hdGroups,
  v => v.tezos
);

function useReadyTemple() {
  const status = useWalletStatus();
  const allNetworks = useWalletNetworks();
  const allAccounts = useWalletAccounts();
  const settings = useWalletSettings();
  const walletsSpecs = useWalletsSpecs();
  const { createWebMavrykSigner, createWebMavrykWallet, updateAccountKYCStatus } = useMavrykClient();

  // Provider tree guarantees this only mounts when ready, but keep explicit
  // check so the remaining hook calls don't run on stale/empty state.
  if (status !== TempleStatus.Ready) throw new Error('Mavryk not ready');

  const queryClient = useQueryClient();

  // Stable primitive array — avoids re-running the effect when allNetworks gets a new reference
  // but the actual RPC URLs haven't changed.
  const allNetworkRpcUrls = useMemo(() => allNetworks.map(n => n.rpcBaseURL), [allNetworks]);

  // Pre-warm chain ID cache for all networks so switching networks is instant.
  // Chain IDs never change for a given RPC endpoint, so a 24h staleTime is effectively permanent.
  useEffect(() => {
    for (const rpcUrl of allNetworkRpcUrls) {
      if (rpcUrl && !queryClient.getQueryData(chainKeys.id(rpcUrl))) {
        void queryClient.prefetchQuery({
          queryKey: chainKeys.id(rpcUrl),
          queryFn: () => loadChainId(rpcUrl).catch(() => null),
          staleTime: CHAIN_ID_STALE_MS
        });
      }
    }
  }, [allNetworkRpcUrls, queryClient]);

  const hdGroups = useMemo(
    () =>
      Object.entries(walletsSpecs)
        .sort(([, { createdAt: aCreatedAt }], [, { createdAt: bCreatedAt }]) => aCreatedAt - bCreatedAt)
        .map(([id, { name }]) => ({ id, name })),
    [walletsSpecs]
  );

  /**
   * Networks
   */

  const defaultNet = allNetworks[0];

  const [networkId, setNetworkId] = usePassiveStorage('network_id', defaultNet.id);

  useEffect(() => {
    if (allNetworks.every(a => a.id !== networkId)) {
      setNetworkId(defaultNet.id);
    }
  }, [allNetworks, networkId, setNetworkId, defaultNet]);

  const network = useMemo(
    () => allNetworks.find(n => n.id === networkId) ?? defaultNet,
    [allNetworks, networkId, defaultNet]
  );

  /**
   * Accounts
   */

  const defaultAcc = allAccounts[0];
  const [accountPkh, setAccountPkh] = usePassiveStorage(ACCOUNT_PKH_STORAGE_KEY, defaultAcc.publicKeyHash, true);

  useEffect(() => {
    return intercom.subscribe((msg: TempleNotification) => {
      switch (msg?.type) {
        case TempleMessageType.SelectedAccountChanged:
          setAccountPkh(msg.accountPublicKeyHash);
          break;
      }
    });
  }, [setAccountPkh]);

  useEffect(() => {
    if (allAccounts.every(a => a.publicKeyHash !== accountPkh)) {
      setAccountPkh(defaultAcc.publicKeyHash);
    }
  }, [allAccounts, accountPkh, setAccountPkh, defaultAcc]);

  const account = useMemo(
    () => allAccounts.find(a => a.publicKeyHash === accountPkh) ?? defaultAcc,
    [allAccounts, accountPkh, defaultAcc]
  );

  /**
   * Error boundary reset
   */

  useLayoutEffect(() => {
    const evt = new CustomEvent('reseterrorboundary');
    window.dispatchEvent(evt);
  }, [networkId, accountPkh]);

  /**
   * tezos = MavrykToolkit instance
   */

  const tezos = useMemo(() => {
    const checksum = [network.id, account.publicKeyHash].join('_');
    const rpc = network.rpcBaseURL;
    const pkh = account.type === TempleAccountType.ManagedKT ? account.owner : account.publicKeyHash;

    const t = new ReactiveTezosToolkit(loadFastRpcClient(rpc), checksum);
    t.setSignerProvider(createWebMavrykSigner(pkh));
    t.setWalletProvider(createWebMavrykWallet(pkh, rpc));
    t.setPackerProvider(michelEncoder);

    return t;
  }, [createWebMavrykSigner, createWebMavrykWallet, network, account]);

  // Get user KYC status ---------------
  // Cancellation flag prevents stale async writes if account/network changes mid-flight.
  useEffect(() => {
    let cancelled = false;

    (async function () {
      const rpcUrl = tezos?.rpc?.getRpcUrl();
      const chainId = await loadChainId(rpcUrl).catch(() => null);
      const isKYC = await getKYCStatus(account.publicKeyHash, chainId);

      if (!cancelled) {
        await updateAccountKYCStatus(account.publicKeyHash, isKYC);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account.publicKeyHash, tezos?.rpc, updateAccountKYCStatus]);

  useEffect(() => {
    if (IS_DEV_ENV) {
      (window as any).mavryk = tezos;
    }
  }, [tezos]);

  return {
    allNetworks,
    network,
    networkId,
    setNetworkId,

    allAccounts,
    account,
    accountPkh,
    setAccountPkh,

    settings,
    hdGroups,
    tezos
  };
}

export function useChainId(suspense?: boolean) {
  const tezos = useTezos();
  const rpcUrl = useMemo(() => tezos?.rpc?.getRpcUrl(), [tezos]);

  const { data: chainId } = useChainIdLoading(rpcUrl, suspense);
  return chainId;
}

export function useChainIdValue(rpcUrl: string, suspense?: boolean) {
  const { data: chainId } = useChainIdLoading(rpcUrl, suspense);

  return chainId;
}

export function useChainIdLoading(rpcUrl: string, suspense?: boolean) {
  /**
   * Stable promise ref for Suspense support. The previous `throw result.refetch()`
   * created a new Promise each render, causing React Suspense to infinite-loop
   * (catch → re-render → new promise → catch → ...). Caching the promise by rpcUrl
   * ensures Suspense receives the same reference until it resolves.
   */
  const suspensePromiseRef = useRef<{ key: string; promise: Promise<unknown> } | null>(null);

  const result = useQuery({
    queryKey: chainKeys.id(rpcUrl),
    queryFn: () => loadChainId(rpcUrl).catch(() => null),
    enabled: !!rpcUrl,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: CHAIN_ID_STALE_MS,
    gcTime: CHAIN_ID_STALE_MS
  });

  if (suspense && result.isLoading && result.fetchStatus !== 'idle') {
    if (!suspensePromiseRef.current || suspensePromiseRef.current.key !== rpcUrl) {
      suspensePromiseRef.current = {
        key: rpcUrl,
        promise: result.refetch().finally(() => {
          suspensePromiseRef.current = null;
        })
      };
    }
    throw suspensePromiseRef.current.promise;
  }

  return result;
}

export function useRelevantAccounts(withExtraTypes = true) {
  const allAccounts = useAllAccounts();
  const account = useAccount();
  const setAccountPkh = useSetAccountPkh();
  const lazyChainId = useChainId();

  const relevantAccounts = useMemo(
    () =>
      allAccounts.filter(acc => {
        switch (acc.type) {
          case TempleAccountType.ManagedKT:
            return withExtraTypes && acc.chainId === lazyChainId;

          case TempleAccountType.WatchOnly:
            return withExtraTypes && (!acc.chainId || acc.chainId === lazyChainId);

          default:
            return true;
        }
      }),
    [allAccounts, lazyChainId, withExtraTypes]
  );

  useEffect(() => {
    if (relevantAccounts.every(a => a.publicKeyHash !== account.publicKeyHash) && lazyChainId) {
      setAccountPkh(relevantAccounts[0].publicKeyHash);
    }
  }, [relevantAccounts, account, setAccountPkh, lazyChainId]);

  return useMemo(() => relevantAccounts, [relevantAccounts]);
}

export class ReactiveTezosToolkit extends MavrykToolkit {
  constructor(rpc: string | RpcClientInterface, public checksum: string) {
    super(rpc);
    this.addExtension(new Tzip16Module());
  }
}

