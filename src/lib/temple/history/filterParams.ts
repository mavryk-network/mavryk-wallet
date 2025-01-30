import { TzktOperationType } from 'lib/apis/tzkt';
import { GetOperationsTransactionsParams } from 'lib/apis/tzkt/api';

import { HistoryItemOpTypeEnum } from './types';

export type ExtendedGetOperationsTransactionsParams = Omit<GetOperationsTransactionsParams, 'entrypoint'> & {
  type: TzktOperationType;
  hasInternals?: boolean;
  entrypoint?: string;
  'entrypoint.null'?: boolean;
  'parameter.originatedContract.null'?: boolean;
  'sender.eq'?: string;
  'target.eq'?: string;
};

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

export const mergeOpParams = (prevParams: GetOperationsTransactionsParams, params: GetOperationsTransactionsParams) => {
  const mergedParams: GetOperationsTransactionsParams = { ...prevParams, ...params };
  // Merge `type` values if both exist
  if (prevParams.type && params.type) {
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    mergedParams.type = Array.from(new Set(`${prevParams.type},${params.type}`.split(',').map(t => t.trim()))).join(
      ','
    ) as ExtendedGetOperationsTransactionsParams['type'];
  }

  return mergedParams;
};
