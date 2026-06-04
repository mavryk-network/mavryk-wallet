import { useCallback, useEffect, useRef } from 'react';

import { Subscription, MavrykToolkit } from '@mavrykdynamics/webmavryk';
import { useQueryClient } from '@tanstack/react-query';
import constate from 'constate';

import { balanceKeys, chainKeys } from 'lib/query-keys';
import { confirmOperation } from 'lib/temple/operation';
import { useUpdatableRef } from 'lib/ui/hooks';

import { useMavryk, useRelevantAccounts } from './ready';

export const [NewBlockTriggersProvider, useBlockTriggers] = constate(useNewBlockTriggers);

function useNewBlockTriggers() {
  const queryClient = useQueryClient();
  const mavryk = useMavryk();
  const allAccounts = useRelevantAccounts();

  const triggerNewBlock = useCallback(() => {
    for (const acc of allAccounts) {
      queryClient.invalidateQueries({ queryKey: balanceKeys.mav(mavryk.checksum, acc.publicKeyHash) });
      queryClient.invalidateQueries({ queryKey: chainKeys.delegate(mavryk.checksum, acc.publicKeyHash) });
    }
  }, [allAccounts, queryClient, mavryk]);

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

export function useOnBlock(callback: (blockHash: string) => void, altMavryk?: MavrykToolkit, pause = false) {
  const currentMavryk = useMavryk();
  const blockHashRef = useRef<string>();
  const callbackRef = useUpdatableRef(callback);

  const mavryk = altMavryk || currentMavryk;

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
        sub = mavryk.stream.subscribe('head');
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
  }, [callbackRef, pause, mavryk]);
}
