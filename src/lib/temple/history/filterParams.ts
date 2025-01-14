import { HistoryItemOpTypeEnum } from './types';

export const createOpParams = (accountAddress: string) => ({
  [HistoryItemOpTypeEnum.Delegation.toString()]: {
    type: 'delegation'
  },
  [HistoryItemOpTypeEnum.Origination.toString()]: {
    type: 'origination'
  },
  [HistoryItemOpTypeEnum.Interaction.toString()]: {
    type: 'transaction',
    'entrypoint.ne': undefined,
    'parameter.amount.eq': 0
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
    entrypoint: 'transfer',
    'initiator.eq': accountAddress
  },
  [HistoryItemOpTypeEnum.TransferFrom.toString()]: {
    type: 'transaction',
    entrypoint: 'transfer',
    'target.eq': accountAddress
  },
  [HistoryItemOpTypeEnum.Other.toString()]: {
    type: 'other'
  }
});
