import { useCallback, useEffect, useRef } from 'react';

import { Subscription, MavrykToolkit } from '@mavrykdynamics/webmavryk';
import constate from 'constate';
import { useSWRConfig } from 'swr';

import { getBalanceSWRKey } from 'lib/balances/utils';
import { confirmOperation } from 'lib/temple/operation';
import { useUpdatableRef } from 'lib/ui/hooks';

import { useTezos, useRelevantAccounts } from './ready';

export const [NewBlockTriggersProvider, useBlockTriggers] = constate(useNewBlockTriggers);

function useNewBlockTriggers() {
  const { mutate } = useSWRConfig();
  const tezos = useTezos();
  const allAccounts = useRelevantAccounts();

  const triggerNewBlock = useCallback(() => {
    for (const acc of allAccounts) {
      mutate(getBalanceSWRKey(tezos, 'mav', acc.publicKeyHash));
      mutate(['delegate', tezos.checksum, acc.publicKeyHash]);
    }
  }, [allAccounts, mutate, tezos]);

  useOnBlock(triggerNewBlock);

  const confirmOperationAndTriggerNewBlock = useCallback<typeof confirmOperation>(
    async (...args) => {
      const result = await confirmOperation(...args);
      triggerNewBlock();
      return result;
    },
    [triggerNewBlock]
  );

  return {
    triggerNewBlock,
    confirmOperationAndTriggerNewBlock
  };
}

export function useOnBlock(callback: (blockHash: string) => void, altTezos?: MavrykToolkit, pause = false) {
  const currentTezos = useTezos();
  const blockHashRef = useRef<string>();
  const callbackRef = useUpdatableRef(callback);

  const tezos = altTezos || currentTezos;

  // Keep a head-block subscription alive for the active RPC.
  // Cleanup closes the current subscription and cancels pending retries on network changes or unmount.
  useEffect(() => {
    if (pause) return;

    let sub: Subscription<string> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    spawnSub();
    return () => {
      cancelled = true;

      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }

      sub?.close();
    };

    function scheduleRespawn() {
      if (cancelled || retryTimeout) {
        return;
      }

      retryTimeout = setTimeout(() => {
        retryTimeout = null;
        spawnSub();
      }, 1000);
    }

    function spawnSub() {
      if (cancelled) {
        return;
      }

      try {
        sub = tezos.stream.subscribe('head');
      } catch (err) {
        console.error(err);
        scheduleRespawn();
        return;
      }

      sub.on('data', hash => {
        if (blockHashRef.current && blockHashRef.current !== hash) {
          callbackRef.current(hash);
        }
        blockHashRef.current = hash;
      });
      sub.on('error', err => {
        console.error(err);
        sub?.close();
        scheduleRespawn();
      });
    }
  }, [callbackRef, pause, tezos]);
}
