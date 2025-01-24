import { HistoryItemOpTypeEnum } from './types';

export const createOpParams = (accountAddress: string) => ({
  [HistoryItemOpTypeEnum.Delegation.toString()]: {
    type: 'delegation' // remove transactions
  },
  [HistoryItemOpTypeEnum.Origination.toString()]: {
    type: 'origination' // all good
  },
  [HistoryItemOpTypeEnum.Interaction.toString()]: {
    type: 'transaction', // wrong data for some reason
    'entrypoint.ne': 'transfer'
  },
  [HistoryItemOpTypeEnum.Reveal.toString()]: {
    type: 'reveal' // remove transactions
  },
  [HistoryItemOpTypeEnum.Swap.toString()]: {
    type: 'transaction', // all good
    entrypoint: 'swap'
  },
  [HistoryItemOpTypeEnum.TransferTo.toString()]: {
    type: 'transaction', // review query
    'sender.eq': accountAddress
  },
  [HistoryItemOpTypeEnum.TransferFrom.toString()]: {
    type: 'transaction', // all good
    'target.eq': accountAddress
  },
  [HistoryItemOpTypeEnum.Other.toString()]: {
    type: 'other' // all good
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
