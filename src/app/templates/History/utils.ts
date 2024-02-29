import { TEZ_TOKEN_SLUG, toTokenSlug } from 'lib/assets';
import { t } from 'lib/i18n';
import { UserHistoryItem } from 'lib/temple/history';
import { HistoryItemOpTypeEnum, HistoryItemTransactionOp } from 'lib/temple/history/types';

export const toHistoryTokenSlug = (historyItem: UserHistoryItem | null, slug?: string) => {
  if (!historyItem || historyItem.operations[0].contractAddress === TEZ_TOKEN_SLUG) return TEZ_TOKEN_SLUG;

  return slug || !historyItem.operations[0]?.contractAddress
    ? TEZ_TOKEN_SLUG
    : toTokenSlug(
        historyItem.operations[0].contractAddress ?? '',
        (historyItem.operations[0] as HistoryItemTransactionOp)?.tokenTransfers?.tokenId
      );
};

export const alterIpfsUrl = (url?: string) => {
  if (!url || url?.split('//')?.shift() !== 'ipfs:') return url;

  return 'https://ipfs.io/ipfs/'.concat(url.split('//').pop() ?? '');
};

export const getOperationTypeI18nKeyVerb = (type: HistoryItemOpTypeEnum) => {
  switch (type) {
    case HistoryItemOpTypeEnum.Delegation:
      return t('delegationToSmb');

    case HistoryItemOpTypeEnum.Origination:
      return t('transaction');
    case HistoryItemOpTypeEnum.Interaction:
      return t('interactionWithContract');

    case HistoryItemOpTypeEnum.TransferFrom:
      return t('transferFromSmb');

    case HistoryItemOpTypeEnum.TransferTo:
      return t('transferToSmb');
    // Other
    case HistoryItemOpTypeEnum.Other:
    default:
      return t('transaction');
  }
};
