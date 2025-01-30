import { ExtendedGetOperationsTransactionsParams } from 'lib/apis/tzkt/api';

import { HistoryItemOpTypeEnum } from './types';

export const createOpParams = (accountAddress: string): StringRecord<ExtendedGetOperationsTransactionsParams> => ({
  [HistoryItemOpTypeEnum.Delegation.toString()]: {
    type: 'delegation'
  },
  [HistoryItemOpTypeEnum.Origination.toString()]: {
    type: 'origination',
    hasInternals: false,
    'parameter.originatedContract.null': false
  },
  [HistoryItemOpTypeEnum.Interaction.toString()]: {
    type: 'transaction',
    'entrypoint.null': false,
    hasInternals: true
  },
  [HistoryItemOpTypeEnum.Reveal.toString()]: {
    type: 'reveal'
  },
  [HistoryItemOpTypeEnum.Swap.toString()]: {
    type: 'transaction',
    entrypoint: 'swap'
  },
  [HistoryItemOpTypeEnum.TransferTo.toString()]: {
    type: 'transaction',
    'sender.eq': accountAddress,
    hasInternals: false,
    'entrypoint.null': true
  },
  [HistoryItemOpTypeEnum.TransferFrom.toString()]: {
    type: 'transaction',
    'target.eq': accountAddress,
    hasInternals: false
  },
  [HistoryItemOpTypeEnum.Other.toString()]: {
    type: 'other'
  }
});

/**
 * Used to merge ONLY specofic params of GetOperationsTransactionsParams
 * @param prevParams createOpParams returned params  object
 * @param params createOpParams returned params  object
 * @returns merged params object
 */
export const mergeOpParams = (
  prevParams: ExtendedGetOperationsTransactionsParams,
  params: ExtendedGetOperationsTransactionsParams
): ExtendedGetOperationsTransactionsParams => {
  const mergedParams: ExtendedGetOperationsTransactionsParams = { ...prevParams, ...params };

  // Merge `type` values (OR condition)
  if (prevParams.type && params.type) {
    mergedParams.type = Array.from(new Set([...prevParams.type.split(','), ...params.type.split(',')])).join(
      ','
    ) as ExtendedGetOperationsTransactionsParams['type'];
  }

  // Merge `entrypoint` and `entrypoint.null`
  const prevEntrypoint = prevParams.entrypoint;
  const prevEntrypointNull = prevParams['entrypoint.null'];
  const paramsEntrypoint = params.entrypoint;
  const paramsEntrypointNull = params['entrypoint.null'];

  if (prevEntrypoint || paramsEntrypoint) {
    const entrypoints = [prevEntrypoint, paramsEntrypoint].filter(Boolean);
    mergedParams.entrypoint = entrypoints.length > 1 ? entrypoints.join(' OR ') : entrypoints[0];
  }

  if (prevEntrypointNull !== undefined || paramsEntrypointNull !== undefined) {
    mergedParams['entrypoint.null'] =
      prevEntrypointNull !== undefined && paramsEntrypointNull !== undefined
        ? prevEntrypointNull || paramsEntrypointNull // OR condition for boolean
        : prevEntrypointNull !== undefined
        ? prevEntrypointNull
        : paramsEntrypointNull;
  }

  // Merge `hasInternals` using logical OR
  if (prevParams.hasInternals !== undefined || params.hasInternals !== undefined) {
    mergedParams.hasInternals = prevParams.hasInternals || params.hasInternals;
  }

  return mergedParams;
};
