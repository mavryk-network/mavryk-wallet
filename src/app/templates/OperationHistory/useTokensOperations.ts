import React from "react";
import { getTokenTransfers } from "lib/better-call-dev";
import {
  getAccountWithOperations,
  TZStatsNetwork,
  TZStatsOperation,
} from "lib/tzstats";
import { ThanosToken } from "lib/thanos/types";
import {
  useOpsPagination,
  FetchFn,
  groupOpsByHash,
} from "app/templates/OperationHistory/helpers";

export type GetOperationsParams = {
  accountPkh: string;
  tzStatsNetwork: TZStatsNetwork | null;
  networkId: "mainnet" | "carthagenet" | "delphinet" | null;
  asset: ThanosToken;
};

export default function useTokensOperations({
  accountPkh,
  tzStatsNetwork,
  networkId,
  asset,
}: GetOperationsParams) {
  const fetchFn = React.useCallback<FetchFn>(
    async (
      tzStatsOffset: number,
      bcdLastId: string | undefined,
      pageSize: number
    ) => {
      const { last_id, transfers: rawBcdOps } = networkId
        ? await getTokenTransfers({
            network: networkId,
            address: accountPkh,
            size: pageSize,
            contracts: asset.address,
            last_id: bcdLastId,
          })
        : { transfers: [], last_id: undefined };
      const lastBcdOp = rawBcdOps[rawBcdOps.length - 1];
      const lastBcdOpTime = new Date(lastBcdOp?.timestamp || 0);
      const groupedBcdOps = groupOpsByHash(rawBcdOps);
      const tzStatsOps: TZStatsOperation[] = [];
      let shouldStopFetchBcdOperations = false;
      let i = 0;
      while (!shouldStopFetchBcdOperations && tzStatsNetwork) {
        const { ops } = await getAccountWithOperations(tzStatsNetwork, {
          pkh: accountPkh,
          order: "desc",
          limit: pageSize,
          offset: tzStatsOffset + pageSize * i,
        });
        tzStatsOps.push(...ops);
        const lastTzStatsOp = tzStatsOps[tzStatsOps.length - 1];
        shouldStopFetchBcdOperations =
          ops.length === 0 || new Date(lastTzStatsOp.time) < lastBcdOpTime;
        i++;
      }
      const groupedTzStatsOps = tzStatsOps
        .filter(({ time }) => new Date(time) >= lastBcdOpTime)
        .reduce<Record<string, TZStatsOperation[]>>(
          (newOps, op) => ({
            ...newOps,
            [op.hash]: [...(newOps[op.hash] || []), op],
          }),
          {}
        );
      const relevantGroupedTzStatsOps = Object.keys(groupedBcdOps).reduce<
        Record<string, TZStatsOperation[]>
      >((relevantOps, opHash) => {
        if (groupedTzStatsOps[opHash]) {
          return {
            ...relevantOps,
            [opHash]: groupedTzStatsOps[opHash],
          };
        }
        return relevantOps;
      }, {});
      const relevantTzStatsOpsCount = Object.values(relevantGroupedTzStatsOps)
        .reduce((sum, ops) => sum + ops.length, 0);

      return {
        lastBcdId: last_id,
        newBcdOps: groupedBcdOps,
        newTzStatsOps: relevantGroupedTzStatsOps,
        bcdReachedEnd: rawBcdOps.length < pageSize,
        tzStatsReachedEnd: relevantTzStatsOpsCount < pageSize,
      };
    },
    [accountPkh, networkId, tzStatsNetwork, asset.address]
  );

  return useOpsPagination(fetchFn, asset);
}
