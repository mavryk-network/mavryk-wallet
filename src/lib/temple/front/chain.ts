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

  useEffect(() => {
    if (pause) return;

    let sub: Subscription<string>;
    spawnSub();
    return () => sub.close();

    function spawnSub() {
      sub = mavryk.stream.subscribe('head');

      sub.on('data', hash => {
        if (blockHashRef.current && blockHashRef.current !== hash) {
          callbackRef.current(hash);
        }
        blockHashRef.current = hash;
      });
      sub.on('error', err => {
        console.error(err);
        sub.close();
        spawnSub();
      });
    }
  }, [pause, mavryk]);
}
