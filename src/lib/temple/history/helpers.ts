import { BigNumber } from 'bignumber.js';

import { MAV_TOKEN_SLUG } from 'lib/assets';
import type { UserHistoryItem } from 'lib/temple/history';

import { useAssetMetadata } from '../../metadata';

import {
  HistoryItemDelegationOp,
  HistoryItemOpTypeEnum,
  HistoryItemOperationBase,
  HistoryItemOriginationOp,
  HistoryItemOtherOp,
  HistoryItemTransactionOp,
  IndividualHistoryItem
} from './types';

export function fillUserHistoryItemsWithTokenMetadata(userHistoryItems: UserHistoryItem[]): UserHistoryItem[] {
  return userHistoryItems.map(item => fillTokenMetadata(item));
}

function fillTokenMetadata(userHistoryItem: UserHistoryItem): UserHistoryItem {
  if (!txHasToken(userHistoryItem.type)) return userHistoryItem;
  const filledOperations = userHistoryItem.operations.map(op => {
    const metadata = useAssetMetadata(op.assetSlug ?? '');
    if (metadata !== null) {
      op.assetMetadata = metadata;
    }
    return op;
  });
  userHistoryItem.operations = filledOperations;
  return userHistoryItem;
}

export function buildHistoryOperStack(historyitem: UserHistoryItem) {
  const opStack: IndividualHistoryItem[] = [];

  for (const oper of historyitem.operations) {
    const basicFields: HistoryItemOperationBase = {
      contractAddress: oper.contractAddress,
      source: oper.source,
      status: oper.status,
      amountSigned: oper.amountSigned,
      addedAt: oper.addedAt,
      isHighlighted: oper.isHighlighted,
      opIndex: oper.opIndex,
      type: oper.type,
      assetSlug: oper.assetSlug,
      assetMetadata: oper.assetMetadata,
      amountDiff: oper.amountDiff,
      id: oper.id,
      hash: oper.hash,
      bakerFee: oper.bakerFee,
      storageFee: oper.storageFee,
      gasUsed: oper.gasUsed,
      storageUsed: oper.storageUsed ?? 0
    };

    switch (oper.type) {
      case HistoryItemOpTypeEnum.Swap:
      case HistoryItemOpTypeEnum.TransferTo:
        const opTo = oper as HistoryItemTransactionOp;

        opStack.push({
          ...basicFields,
          type: HistoryItemOpTypeEnum.TransferTo,
          destination: opTo.destination,
          tokenTransfers: opTo.tokenTransfers,
          entrypoint: opTo.entrypoint
        });
        break;

      case HistoryItemOpTypeEnum.TransferFrom:
        const opFrom = oper as HistoryItemTransactionOp;

        opStack.push({
          ...basicFields,
          type: HistoryItemOpTypeEnum.TransferFrom,
          destination: opFrom.destination,
          tokenTransfers: opFrom.tokenTransfers,
          entrypoint: opFrom.entrypoint
        });
        break;

      case HistoryItemOpTypeEnum.Interaction:
        const opInteract = oper as HistoryItemTransactionOp;

        opStack.push({
          ...basicFields,
          type: HistoryItemOpTypeEnum.Interaction,
          destination: opInteract.destination,
          tokenTransfers: opInteract.tokenTransfers,
          entrypoint: opInteract.entrypoint
        });

        break;
      case HistoryItemOpTypeEnum.Delegation:
        const opDelegate = oper as HistoryItemDelegationOp;

        opStack.push({
          ...basicFields,
          initiator: oper.source,
          nonce: opDelegate.nonce,
          prevDelegate: opDelegate.prevDelegate,
          newDelegate: opDelegate.newDelegate,
          type: HistoryItemOpTypeEnum.Delegation
        });
        break;
      case HistoryItemOpTypeEnum.Reveal:
        // const opReveal = oper as HistoryItemOpReveal;
        opStack.push({
          ...basicFields,
          type: HistoryItemOpTypeEnum.Reveal
        });

        break;
      case HistoryItemOpTypeEnum.Origination:
        const opOrigination = oper as HistoryItemOriginationOp;

        opStack.push({
          ...basicFields,
          originatedContract: opOrigination.originatedContract,
          contractBalance: opOrigination.contractBalance,
          type: HistoryItemOpTypeEnum.Origination
        });
        break;
      default:
        const opOther = oper as HistoryItemOtherOp;

        opStack.push({
          ...basicFields,
          destination: opOther.destination,
          type: HistoryItemOpTypeEnum.Other,
          name: opOther.name
        });
        break;
    }
  }

  return opStack;
}

export interface MoneyDiff {
  assetSlug: string;
  diff: string;
}

export function buildHistoryMoneyDiffs(historyItem: UserHistoryItem | null, allowZero = false) {
  const diffs: MoneyDiff[] = [];

  if (!historyItem) return diffs;

  for (const oper of historyItem.operations) {
    // TODO check why Origination type returns another token diff when called with Interaction or Multiple op
    if ((isZero(oper.amountSigned) && !allowZero) || oper.type === HistoryItemOpTypeEnum.Origination) continue;

    const assetSlug =
      // @ts-expect-error
      oper.contractAddress == null ? MAV_TOKEN_SLUG : toTokenSlug(oper.contractAddress, oper.tokenTransfers?.tokenId);
    const diff = new BigNumber(oper.amountSigned).toFixed();
    diffs.push({ assetSlug, diff });
  }

  return diffs;
}

export const isZero = (val: BigNumber.Value) => new BigNumber(val).isZero();

const toTokenSlug = (contractAddress: string, tokenId: string | number = 0) =>
  contractAddress === MAV_TOKEN_SLUG ? contractAddress : `${contractAddress}_${tokenId}`;

const txHasToken = (txType: HistoryItemOpTypeEnum) => {
  switch (txType) {
    case HistoryItemOpTypeEnum.TransferTo:
    case HistoryItemOpTypeEnum.TransferFrom:
    case HistoryItemOpTypeEnum.Delegation:
    case HistoryItemOpTypeEnum.Swap:
      return true;
    case HistoryItemOpTypeEnum.Interaction:
    case HistoryItemOpTypeEnum.Origination:
    case HistoryItemOpTypeEnum.Reveal:
    case HistoryItemOpTypeEnum.Other:
    default:
      return false;
  }
};

export const getMoneyDiff = (amountSigned: string): string => new BigNumber(amountSigned).toFixed();
