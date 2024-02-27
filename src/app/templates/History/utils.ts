import { UserHistoryItem } from 'lib/temple/history';

export const toTokenSlug = (contractAddress: string, tokenId: string | number = 0) =>
  contractAddress === 'tez' ? contractAddress : `${contractAddress}_${tokenId}`;

export const toHistoryTokenSlug = (historyItem: UserHistoryItem, slug?: string) => {
  return slug || !historyItem.operations[0]?.contractAddress
    ? 'tez'
    : toTokenSlug(historyItem.operations[0].contractAddress ?? '', historyItem.operations[0]?.tokenTransfers?.tokenId);
};
