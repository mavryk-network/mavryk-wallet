import { HistoryItemOpTypeEnum } from './types';

export const createOpParams = (accountAddress: string) => ({
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

export const mergeOpParams = (prevParams: StringRecord<string | number>, params: StringRecord<string | number>) => {
  const mergedParams = { ...prevParams, ...params };

  // Merge `type` values if both exist
  if (prevParams.type && params.type) {
    mergedParams.type = Array.from(new Set(`${prevParams.type},${params.type}`.split(',').map(t => t.trim()))).join(
      ','
    );
  }

  return mergedParams;
};
