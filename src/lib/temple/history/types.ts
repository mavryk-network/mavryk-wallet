import type { TzktAlias, TzktOperation, TzktTokenTransfer } from 'lib/apis/tzkt';
import type { MavrykHistoryAction } from 'mavryk/api/history';

import type { AssetMetadataBase } from '../../metadata';

export type HistoryItemStatus = TzktOperation['status'] | 'pending';
export type HistoryMember = TzktAlias;

export interface OperationsGroup {
  hash: string;
  operations: TzktOperation[];
}

/**
 * Who paid the group's network fee, from complete action evidence only.
 * `wallet`: the viewed account; `other`: one different address; `mixed`: actions exist but evidence is mixed/incomplete.
 * Absent when no supported actions are present (legacy rendering).
 */
export type HistoryNetworkFeePayer = { kind: 'wallet' } | { kind: 'other'; address: string } | { kind: 'mixed' };

export interface UserHistoryItem {
  /** Local card identity within the loaded scope; several cards may share one hash. */
  id: string;
  type: HistoryItemOpTypeEnum;
  hash: string;
  /** Semantic actions of this group, deduplicated by action ID, in API order. */
  actions?: MavrykHistoryAction[];
  networkFeePayer?: HistoryNetworkFeePayer;
  /** True when any action ran through a permit (gasless) relay; says nothing about who paid. */
  isGasless?: boolean;
  /** Total child operations reported by the API; the `operations` preview may be capped below it. */
  operationsCount?: number;
  addedAt: string;
  status: HistoryItemStatus;
  operations: IndividualHistoryItem[];
  mainOperation?: IndividualHistoryItem;
  displayMoneyDiffs?: HistoryDisplayMoneyDiff[];
  hideOperationMoneyDiffs?: boolean;
  isPartialTransfers?: boolean;
  highlightedOperationIndex: number; // Index of the highlighted operation within the group
  isGroupedOp: boolean;
  firstOperation?: IndividualHistoryItem;
  oldestOperation?: IndividualHistoryItem;
}

export interface HistoryDisplayMoneyDiff {
  symbol?: string;
  assetSlug: string;
  diff: string;
  usdAmount?: number | null;
  isNeutral?: boolean;
  /** Direction remains known even when the token amount is unavailable. */
  isNegative?: boolean;
  isAmountUnavailable?: boolean;
}

export interface HistoryOperationNetworkFees {
  totalFee: number;
  gasFee: number;
  storageFee: number;
  burnedFromFees: number;
  usdAmount?: number;
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
  Reveal,
  Multiple,
  Staking
}

export enum StakingActions {
  stake = 'stake',
  finalize = 'finalize',
  unstake = 'unstake',
  restake = 'restake',
  slash_staked = 'slash_staked',
  slash_unstaked = 'slash_unstaked'
}

export interface HistoryItemOperationBase extends PickedPropsFromTzktOperation {
  contractAddress?: string;
  calledContract?: string;
  movementKind?: 'mint' | 'burn';
  displayMoneyDiff?: HistoryDisplayMoneyDiff;
  source: HistoryMember;
  status: HistoryItemStatus;
  amountSigned: string;
  /** Raw purchase quantity; never used as a display-unit amount. */
  atomicAmount?: string;
  isAmountUnavailable?: boolean;
  addedAt: string;
  isHighlighted: boolean;
  opIndex: number;
  type?: HistoryItemOpTypeEnum;
  assetSlug?: string;
  assetMetadata?: AssetMetadataBase;
  amountDiff?: string;
  bakerFee: number;
  storageFee: number;
  gasUsed: number;
  storageUsed: number;
  entrypoint?: string;
  networkFees?: HistoryOperationNetworkFees;
}

export interface HistoryItemTransactionOp extends HistoryItemOperationBase {
  type: HistoryItemOpTypeEnum;
  destination: HistoryMember;
  tokenTransfers?: HistoryItemTokenTransfer;
  entrypoint?: string;
}
export interface HistoryItemSwapOp extends HistoryItemOperationBase {
  type: HistoryItemOpTypeEnum.Swap;
}

export interface HistoryItemOtherOp extends HistoryItemOperationBase {
  destination?: HistoryMember;
  name: string;
  type: HistoryItemOpTypeEnum.Other;
}

export interface HistoryItemDelegationOp extends HistoryItemOperationBase {
  isHighlighted: boolean;
  initiator?: HistoryMember;
  nonce?: number;
  amount?: number;
  prevDelegate?: HistoryMember | null;
  newDelegate?: HistoryMember | null;
  type: HistoryItemOpTypeEnum.Delegation;
}

export interface HistoryItemStakingOp extends HistoryItemOperationBase {
  amount?: number;
  action: StakingActions;
  sender?: HistoryMember;
  baker?: HistoryMember | null;
  type: HistoryItemOpTypeEnum.Staking;
}

export interface HistoryItemOriginationOp extends HistoryItemOperationBase {
  isHighlighted: boolean;
  originatedContract?: HistoryMember;
  contractBalance?: string;
  type: HistoryItemOpTypeEnum.Origination;
}

export interface HistoryItemOpReveal extends HistoryItemOperationBase {
  isHighlighted: boolean;
  type: HistoryItemOpTypeEnum.Reveal;
}

export type IndividualHistoryItem =
  | HistoryItemTransactionOp
  | HistoryItemDelegationOp
  | HistoryItemOriginationOp
  | HistoryItemOpReveal
  | HistoryItemOtherOp
  | HistoryItemSwapOp
  | HistoryItemStakingOp;

export interface UserHistory {
  items: UserHistoryItem[];
}

type PickedPropsFromTzktTokenTransfer = Pick<TzktTokenTransfer, 'id' | 'level'>;

export type TokenType = 'mav' | 'fa12' | 'fa2';

export interface HistoryItemTokenTransfer extends PickedPropsFromTzktTokenTransfer {
  sender: HistoryMember;
  recipients?: RecipientInfo[];
  totalAmount: string;
  tokenContractAddress: string;
  tokenId: number | string;
  tokenType: TokenType;
  assetSlug: string;
  assetMetadata?: AssetMetadataBase;
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

export type OlderThanParams = {
  'timestamp.lt': string | undefined;
};
