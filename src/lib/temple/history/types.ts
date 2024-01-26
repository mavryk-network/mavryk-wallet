import { TzktAlias, TzktTokenTransfer, TzktOperation } from 'lib/apis/tzkt';

export type HistoryItemStatus = TzktOperation['status'] | 'pending';
export type HistoryMember = TzktAlias;

export interface OperationsGroup {
  hash: string;
  operations: TzktOperation[];
}

export interface UserHistoryItem {
  type: HistoryItemOpTypeEnum;
  hash: string;
  addedAt: string;
  status: HistoryItemStatus;
  operations: IndividualHistoryItem[];
  highlightedOperationIndex: number; // Index of the highlighted operation within the group
  isGroupedOp: boolean;
  firstOperation?: IndividualHistoryItem;
  oldestOperation?: IndividualHistoryItem;
}

type PickedPropsFromTzktOperation = Pick<TzktOperation, 'id' | 'level' | 'hash' | 'block'>;

export enum HistoryItemOpTypeEnum {
  TransferTo,
  TransferFrom,
  Delegation,
  Interaction,
  Origination,
  Other,
  Swap,
  Reveal
}

export interface HistoryItemOperationBase extends PickedPropsFromTzktOperation {
  contractAddress?: string;
  source: HistoryMember;
  status: HistoryItemStatus;
  amountSigned: string;
  addedAt: string;
  isHighlighted: boolean;
  opType?: HistoryItemOpTypeEnum;
  opIndex: number;
}

export interface HistoryItemTransactionOp extends HistoryItemOperationBase {
  type: HistoryItemOpTypeEnum | 'transaction';
  destination: HistoryMember;
  tokenTransfers?: HistoryItemTokenTransfer;
  entrypoint?: string;
}

export interface HistoryItemOtherOp extends HistoryItemOperationBase {
  destination?: HistoryMember;
  opType: HistoryItemOpTypeEnum.Other;
}

export interface HistoryItemDelegationOp extends HistoryItemOperationBase {
  isHighlighted: boolean;
  initiator?: HistoryMember;
  nonce?: number;
  amount?: number;
  prevDelegate?: HistoryMember | null;
  newDelegate?: HistoryMember | null;
  opType: HistoryItemOpTypeEnum.Delegation;
}

export interface HistoryItemOriginationOp extends HistoryItemOperationBase {
  isHighlighted: boolean;
  originatedContract?: HistoryMember;
  contractBalance?: string;
  opType: HistoryItemOpTypeEnum.Origination;
}

export interface HistoryItemOpReveal extends HistoryItemOperationBase {
  isHighlighted: boolean;
  opType: HistoryItemOpTypeEnum.Reveal;
}

export type IndividualHistoryItem =
  | HistoryItemTransactionOp
  | HistoryItemDelegationOp
  | HistoryItemOriginationOp
  | HistoryItemOpReveal
  | HistoryItemOtherOp;

export interface UserHistory {
  items: UserHistoryItem[];
}

type PickedPropsFromTzktTokenTransfer = Pick<TzktTokenTransfer, 'id' | 'level'>;

export type TokenType = 'tez' | 'fa12' | 'fa2';

export interface HistoryItemTokenTransfer extends PickedPropsFromTzktTokenTransfer {
  sender: HistoryMember;
  recipients?: RecipientInfo[];
  totalAmount: string;
  tokenContractAddress: string;
  tokenId: number;
  tokenType: TokenType;
  tokenMetadata: {
    name: string;
    symbol: string;
    decimals: string;
    thumbnailUri?: string;
  };
}

export type RecipientInfo = {
  to: HistoryMember;
  amount: string;
};

export type TransferSummary = {
  from: string;
  totalAmount: string;
  tokenId: string;
  recipients: RecipientInfo[];
};

export type Fa2TransferSummaryArray = TransferSummary[];
