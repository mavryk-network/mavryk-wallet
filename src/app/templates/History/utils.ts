import BigNumber from 'bignumber.js';

import { MAV_TOKEN_SLUG, isMavSlug, toTokenSlug } from 'lib/assets';
import { t } from 'lib/i18n';
import { getPredefinedBakerProperty } from 'lib/temple/front/baking/utils';
import { isZero, MoneyDiff } from 'lib/temple/history/helpers';
import {
  HistoryItemDelegationOp,
  HistoryItemOpTypeEnum,
  HistoryItemOriginationOp,
  HistoryItemOtherOp,
  HistoryItemStatus,
  HistoryItemStakingOp,
  HistoryItemTransactionOp,
  StakingActions,
  IndividualHistoryItem,
  UserHistoryItem
} from 'lib/temple/history/types';

export const getMainHistoryOperation = (historyItem: UserHistoryItem | null | undefined) =>
  historyItem?.mainOperation ?? historyItem?.operations[0];

export const toHistoryTokenSlug = (historyItem: UserHistoryItem | null | undefined, slug?: string) => {
  const mainOperation = getMainHistoryOperation(historyItem);

  if (historyItem?.displayMoneyDiffs?.length) {
    return slug ?? historyItem.displayMoneyDiffs[0].assetSlug;
  }

  if (!historyItem || mainOperation?.contractAddress === MAV_TOKEN_SLUG) return MAV_TOKEN_SLUG;

  return slug || !mainOperation?.contractAddress
    ? MAV_TOKEN_SLUG
    : toTokenSlug(
        mainOperation.contractAddress ?? '',
        (mainOperation as HistoryItemTransactionOp)?.tokenTransfers?.tokenId
      );
};

export const buildHistoryPreviewOperations = (
  historyItem: UserHistoryItem,
  operStack: IndividualHistoryItem[],
  previewSize: number
) => {
  if (!historyItem.mainOperation) {
    return operStack.filter((_, i) => i < previewSize).map(op => ({ ...op, type: historyItem.type }));
  }

  const mainOperation = getMainHistoryOperation(historyItem);
  if (!mainOperation) return [];

  return [{ ...mainOperation, type: historyItem.type }, ...operStack.slice(0, Math.max(previewSize - 1, 0))];
};

export const getHistoryPreviewStackOffset = (historyItem: UserHistoryItem, previewSize: number) =>
  historyItem.mainOperation ? Math.max(previewSize - 1, 0) : previewSize;

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
  if (item?.displayMoneyDiffs?.length) {
    return [...new Set(item.displayMoneyDiffs.map(({ assetSlug }) => assetSlug).filter(Boolean))];
  }

  if (!item || item.operations.length <= 1) return [toHistoryTokenSlug(item)];

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

const getTransactionTargetAddress = (operation?: Partial<HistoryItemTransactionOp>) =>
  operation?.destination?.address ?? operation?.tokenTransfers?.recipients?.[0]?.to.address;

export const getHistoryOperationAddress = (
  item: IndividualHistoryItem | null | undefined,
  originalHistoryItem?: UserHistoryItem
): string => {
  if (!item) return '';

  switch (item.type) {
    case HistoryItemOpTypeEnum.Delegation: {
      const delegationOp = item as HistoryItemDelegationOp;

      return (
        delegationOp.newDelegate?.address ??
        delegationOp.prevDelegate?.address ??
        delegationOp.source.address ??
        delegationOp.hash
      );
    }

    case HistoryItemOpTypeEnum.Staking: {
      const stakingOp = item as HistoryItemStakingOp;

      return stakingOp.baker?.address ?? stakingOp.sender?.address ?? stakingOp.source.address ?? stakingOp.hash;
    }

    case HistoryItemOpTypeEnum.Origination: {
      const originationOp = item as HistoryItemOriginationOp;

      return originationOp.originatedContract?.address ?? originationOp.source.address ?? originationOp.hash;
    }

    case HistoryItemOpTypeEnum.TransferFrom:
      return item.source.address ?? getTransactionTargetAddress(item as HistoryItemTransactionOp) ?? item.hash;

    case HistoryItemOpTypeEnum.TransferTo:
    case HistoryItemOpTypeEnum.Interaction:
    case HistoryItemOpTypeEnum.Swap: {
      const txOp = item as HistoryItemTransactionOp;

      return getTransactionTargetAddress(txOp) ?? txOp.source.address ?? txOp.hash;
    }

    case HistoryItemOpTypeEnum.Multiple: {
      const groupedOperation =
        getMainHistoryOperation(originalHistoryItem) ??
        originalHistoryItem?.operations.find(operation =>
          getTransactionTargetAddress(operation as HistoryItemTransactionOp)
        ) ??
        originalHistoryItem?.operations[0];

      return getHistoryOperationAddress(groupedOperation, undefined) || item.source.address || item.hash;
    }

    case HistoryItemOpTypeEnum.Reveal:
      return item.source.address ?? item.hash;

    case HistoryItemOpTypeEnum.Other:
    default: {
      const otherOp = item as HistoryItemOtherOp;

      return otherOp.destination?.address ?? otherOp.source.address ?? otherOp.hash;
    }
  }
};

export const getMultipleInteractionMessageData = (
  item: HistoryItemTransactionOp,
  originalHistoryItem?: UserHistoryItem
) => {
  const entrypoint = item.entrypoint?.trim() || undefined;

  return {
    entrypoint,
    contractAddress: getHistoryOperationAddress(item, originalHistoryItem),
    countLabel: `${originalHistoryItem ? originalHistoryItem.operations.length - 1 : 1} more`
  } as const;
};

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

export const deriveStatusColorClassName = (status: HistoryItemStatus): [HistoryItemStatus, string, string] => {
  let textColorClassName = 'text-primary-info';
  let borderColorClassname = 'border-primary-info';

  switch (status) {
    case 'applied':
      textColorClassName = 'text-primary-success';
      borderColorClassname = 'border-primary-success';
      break;
    case 'failed':
      textColorClassName = 'text-primary-error';
      borderColorClassname = 'border-primary-error';
      break;
    case 'backtracked':
      textColorClassName = 'text-blue-510';
      borderColorClassname = 'border-blue-510';
      break;
    case 'skipped':
      textColorClassName = 'text-gray-700';
      borderColorClassname = 'border-gray-700';
      break;
    case 'pending':
      textColorClassName = 'text-orange-600';
      borderColorClassname = 'border-orange-600';
      break;
    default:
      textColorClassName = 'text-primary-info';
      borderColorClassname = 'border-primary-info';
      break;
  }

  return [status, textColorClassName, borderColorClassname];
};

interface StakingMessage {
  titleNode: string;
  args: (string | JSX.Element)[];
}

export function getStakingMessage(
  updateType: StakingActions,
  isValidator: boolean,
  senderAddress?: string,
  bakerAddress?: string
): StakingMessage {
  const sender = senderAddress ?? 'unknown';
  const baker = getPredefinedBakerProperty(bakerAddress) ?? 'unknown';

  switch (updateType) {
    case StakingActions.stake:
      return {
        titleNode: isValidator ? 'Received stake from' : 'Staked to',
        args: [isValidator ? sender : baker]
      };

    case StakingActions.unstake:
      return {
        titleNode: isValidator ? 'Stake withdrawn by' : 'Unstaked from',
        args: [isValidator ? sender : baker]
      };

    case StakingActions.restake:
      return {
        titleNode: isValidator ? 'Received restake from' : 'Restaked to',
        args: [isValidator ? sender : baker]
      };

    case StakingActions.finalize:
      return {
        titleNode: isValidator ? 'Unstake finalized for' : 'Finalized unstake from',
        args: [isValidator ? sender : baker]
      };

    case StakingActions.slash_staked:
      return {
        titleNode: isValidator ? 'Slashed stake from' : 'Slashed on',
        args: [isValidator ? sender : baker]
      };

    case StakingActions.slash_unstaked:
      return {
        titleNode: isValidator ? 'Slashed pending unstake from' : 'Slashed (pending unstake) on',
        args: [isValidator ? sender : baker]
      };

    default:
      return { titleNode: 'Staking', args: [] };
  }
}
