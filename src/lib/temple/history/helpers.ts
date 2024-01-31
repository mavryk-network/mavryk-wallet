import type { UserHistoryItem } from 'lib/temple/history';

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
  const diffs: MoneyDiff[] = [];

  // for (const oper of historyItem.operations) {
  //   if (oper.opType !== 'transaction' || isZero(oper.amountSigned)) continue;
  //   const assetSlug = oper.contractAddress == null ? 'tez' : toTokenSlug(oper.contractAddress, oper.tokenId);
  //   const diff = new BigNumber(oper.amountSigned).toFixed();
  //   diffs.push({ assetSlug, diff });
  // }

  return diffs;
}

const toTokenSlug = (contractAddress: string, tokenId: string | number = 0) => `${contractAddress}_${tokenId}`;
