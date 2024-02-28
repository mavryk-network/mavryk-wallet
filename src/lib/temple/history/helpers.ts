import { BigNumber } from 'bignumber.js';

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
    console.log(metadata);
    if (metadata !== null) {
      op.assetMetadata = metadata;
    }
    return op;
  });
  userHistoryItem.operations = filledOperations;
  return userHistoryItem;
}

// function pickHistoryitemType(item: IndividualHistoryItem) {
//   switch (item.type) {
//     case HistoryItemOpTypeEnum.TransferTo:
//       return item as unknown as HistoryItemTransactionOp;
//     case HistoryItemOpTypeEnum.TransferFrom:
//       return item as unknown as HistoryItemTransactionOp;
//     case HistoryItemOpTypeEnum.Swap:
//     case HistoryItemOpTypeEnum.Interaction:
//       return item as unknown as HistoryItemTransactionOp;
//     case HistoryItemOpTypeEnum.Delegation:
//       return item as unknown as HistoryItemDelegationOp;
//     case HistoryItemOpTypeEnum.Reveal:
//       return item as unknown as HistoryItemOpReveal;
//     case HistoryItemOpTypeEnum.Origination:
//       return item as unknown as HistoryItemOriginationOp;
//     default:
//       return item as unknown as HistoryItemOtherOp;
//   }
// }

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
      type: oper.type ?? 'unknown',
      assetSlug: oper.assetSlug,
      assetMetadata: oper.assetMetadata,
      amountDiff: oper.amountDiff,
      id: oper.id,
      hash: oper.hash,
      bakerFee: oper.bakerFee,
      storageFee: oper.storageFee
    };

    switch (oper.type) {
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
      // TODO add swap
      case HistoryItemOpTypeEnum.Swap:
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

        console.log(oper, 'oper');

        opStack.push({
          ...basicFields,
          destination: opOther.destination,
          type: HistoryItemOpTypeEnum.Other,
          name: opOther.type as unknown as string
        });
        break;
    }
  }

  return opStack.sort((a, b) => a.type - b.type);
}

export interface MoneyDiff {
  assetSlug: string;
  diff: string;
}

export function buildHistoryMoneyDiffs(historyItem: UserHistoryItem | null, allowZero = false) {
  const diffs: MoneyDiff[] = [];

  if (!historyItem) return diffs;

  for (const oper of historyItem.operations) {
    if (isZero(oper.amountSigned) && !allowZero) continue;

    const assetSlug =
      // @ts-ignore
      oper.contractAddress == null ? 'tez' : toTokenSlug(oper.contractAddress, oper.tokenTransfers?.tokenId);
    const diff = new BigNumber(oper.amountSigned).toFixed();
    diffs.push({ assetSlug, diff });
  }

  return diffs;
}

export const isZero = (val: BigNumber.Value) => new BigNumber(val).isZero();

const toTokenSlug = (contractAddress: string, tokenId: string | number = 0) =>
  contractAddress === 'tez' ? contractAddress : `${contractAddress}_${tokenId}`;

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
