import BigNumber from 'bignumber.js';

import { MAV_TOKEN_SLUG, isMavSlug, toTokenSlug } from 'lib/assets';
import { t } from 'lib/i18n';
import { isZero, MoneyDiff } from 'lib/temple/history/helpers';
import { HistoryItemOpTypeEnum, HistoryItemTransactionOp, UserHistoryItem } from 'lib/temple/history/types';

export const toHistoryTokenSlug = (historyItem: UserHistoryItem | null | undefined, slug?: string) => {
  if (!historyItem || historyItem.operations[0].contractAddress === MAV_TOKEN_SLUG) return MAV_TOKEN_SLUG;

  return slug || !historyItem.operations[0]?.contractAddress
    ? MAV_TOKEN_SLUG
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

export function getAssetsFromOperations(item: UserHistoryItem | null | undefined) {
  if (!item || item.operations.length === 1) return [toHistoryTokenSlug(item)];

  const slugs = item.operations.reduce<string[]>((acc, op) => {
    const tokenId = (op as HistoryItemTransactionOp).tokenTransfers?.tokenId ?? 0;

    let assetSlug: string = '';

    if (op.contractAddress) {
      if (isMavSlug(op.contractAddress)) {
        assetSlug = MAV_TOKEN_SLUG;
      } else {
        assetSlug = toTokenSlug(op.contractAddress, tokenId);
      }
    } else if (op.type === HistoryItemOpTypeEnum.Delegation) {
      assetSlug = MAV_TOKEN_SLUG;
    }
    acc = [...new Set([...acc, assetSlug].filter(o => Boolean(o)))];
    return acc;
  }, []);

  return slugs;
}

export function getMoneyDiffsForSwap(moneyDiffs: MoneyDiff[]) {
  const diff = [...moneyDiffs.filter(m => !new BigNumber(m.diff).isZero())];

  //the last item is token we exchnaged
  // the first itme is token we got
  // f.e if swap TEZ to KUSD -> items[0] === KUSD, item[last] === TEZ
  return [diff[0], diff[diff.length - 1]];
}

export function getMoneyDiffForMultiple(diffs: MoneyDiff[], previewSize: number) {
  const record: StringRecord<MoneyDiff> = {};

  diffs.forEach(diff => {
    if (!isZero(diff.diff)) {
      record[diff.assetSlug] = diff;
    }
  });

  return Object.values(record).slice(0, previewSize);
}
