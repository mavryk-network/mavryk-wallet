import { BigNumber } from 'bignumber.js';

import type { UserHistoryItem } from 'lib/temple/history';

import { useAssetMetadata } from '../../metadata';
import { HistoryItemOpTypeEnum } from './types';

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

// export function buildUserHistory(userHistoryItems: any[]): UserHistory {
//   const historyItems: UserHistoryItem[] = [];
//
//   userHistoryItems.forEach(item => {
//     switch (item.type) {
//       case 'transaction':
//         historyItems.push(processTransactionOperation(item));
//         break;
//       // Handle other types (delegation, origination, etc.)
//       // ...
//       default:
//         historyItems.push(transformToTzktHistoryBase(item)); // For other or unknown types
//     }
//   });
//
//   const groupedItems = groupOperationsByHash(historyItems);
//
//   return { items: groupedItems };
// }

// export function buildOperStack(historyItem: HistoryItem, address: string) {
//   const opStack: OperStackItemInterface[] = [];
//
//   for (const oper of historyItem.operations) {
//     if (oper.type === 'transaction') {
//       if (isZero(oper.amountSigned)) {
//         opStack.push({
//           type: OperStackItemTypeEnum.Interaction,
//           with: oper.destination.address,
//           entrypoint: oper.entrypoint
//         });
//       } else if (oper.source.address === address) {
//         opStack.push({
//           type: OperStackItemTypeEnum.TransferTo,
//           to: oper.destination.address
//         });
//       } else if (oper.destination.address === address) {
//         opStack.push({
//           type: OperStackItemTypeEnum.TransferFrom,
//           from: oper.source.address
//         });
//       }
//     } else if (oper.type === 'delegation' && oper.source.address === address && oper.destination) {
//       opStack.push({
//         type: OperStackItemTypeEnum.Delegation,
//         to: oper.destination.address
//       });
//     } else {
//       opStack.push({
//         type: OperStackItemTypeEnum.Other,
//         name: oper.type
//       });
//     }
//   }
//
//   return opStack.sort((a, b) => a.type - b.type);
// }

interface MoneyDiff {
  assetSlug: string;
  diff: string;
}

export function buildMoneyDiffs(historyItem: UserHistoryItem) {
  //TODO: This was how the money diffs were compiled before. It created a separate array for the diffs that was rendered
  // on the side. We need it to render together.
  const diffs: MoneyDiff[] = [];
  // for (const oper of historyItem.operations) {
  //   if (oper.opType !== 'transaction' || isZero(oper.amountSigned)) continue;
  //   const assetSlug = oper.contractAddress == null ? 'tez' : toTokenSlug(oper.contractAddress, oper.tokenId);
  //   const diff = new BigNumber(oper.amountSigned).toFixed();
  //   diffs.push({ assetSlug, diff });
  // }

  return diffs;
}

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
