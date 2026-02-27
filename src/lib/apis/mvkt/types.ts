import { OperationStatus } from '@mavrykdynamics/webmavryk';
import { HubConnection } from '@microsoft/signalr';

import { StakingActions } from 'lib/temple/history/types';

/**
 * Actually, there is a bunch of other types but only these will be used for now
 */
export type MvktOperationType = 'delegation' | 'transaction' | 'reveal' | 'origination' | 'staking' | 'other';

export type MvktQuoteCurrency = 'None' | 'Btc' | 'Eur' | 'Usd' | 'Cny' | 'Jpy' | 'Krw';

type MvktOperationStatus = 'applied' | 'failed' | 'backtracked' | 'skipped';

type MvktContractType = 'delegator_contract' | 'smart_contract';

export interface MvktDiffs {
  bigmap: number;
  path: string;
  action: string;
  content: {
    hash: string;
    key: string;
    value: string;
  };
}

export interface MvktAlias {
  alias?: string;
  address: string;
}

interface MvktOperationError {
  type: string;
}

/**
 * To be reviewed if a new operation type is added
 */
export interface MvktOperationBase {
  type: MvktOperationType;
  id: number;
  level?: number;
  /** ISO Date */
  timestamp: string;
  block?: string;
  hash: string;
  counter: number;
  sender: MvktAlias;
  gasLimit: number;
  gasUsed: number;
  storageUsed?: number;
  storageFee?: number;
  bakerFee: number;
  quote?: MvktQuote;
  errors?: MvktOperationError[] | null;
  status: MvktOperationStatus;
}

type MvktQuote = Partial<Record<MvktQuoteCurrency, number>>;

interface MvktDelegationOperation extends MvktOperationBase {
  type: 'delegation';
  initiator?: MvktAlias;
  nonce?: number;
  amount?: number;
  prevDelegate?: MvktAlias | null;
  newDelegate?: MvktAlias | null;
}

interface MvktStakingOperation extends MvktOperationBase {
  type: 'staking';
  amount?: number;
  action: StakingActions;
  requestedAmount: number;
  baker?: MvktAlias | null;
  stakingUpdatesCount: number;
  status: MvktOperationStatus;
  kind: string;
}

export interface MvktTransactionOperation extends MvktOperationBase {
  type: 'transaction';
  initiator?: MvktAlias;
  nonce?: number;
  storageLimit: number;
  storageUsed: number;
  storageFee: number;
  allocationFee: number;
  target: MvktAlias;
  amount: number;
  parameter?: any;
  diffs?: MvktDiffs[];
  entrypoint?: string;
  hasInternals: boolean;
}

export interface MvktOriginationOperation extends MvktOperationBase {
  type: 'origination';
  originatedContract?: MvktAlias;
  contractBalance?: string;
}

export interface MvktOtherOperation extends MvktOperationBase {
  type: 'other';
}

export interface MvktRevealOperation extends MvktOperationBase {
  type: 'reveal';
}

export type MvktOperation =
  | MvktDelegationOperation
  | MvktTransactionOperation
  | MvktRevealOperation
  | MvktOriginationOperation
  | MvktStakingOperation
  | MvktOtherOperation;

type MvktDelegateInfo = {
  alias?: string;
  address: string;
  active: boolean;
};

export type MvktRelatedContract = {
  kind: MvktContractType;
  alias?: string;
  address: string;
  balance: number;
  delegate?: MvktDelegateInfo;
  creationLevel: number;
  creationTime: string;
};

export const allInt32ParameterKeys = ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'in', 'ni'] as const;

type Int32ParameterKey = (typeof allInt32ParameterKeys)[number];

type Int32Parameter = Partial<Record<Int32ParameterKey, number>>;

export type MvktGetRewardsParams = {
  address: string;
  cycle?: Int32Parameter;
  sort?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
  quote?: MvktQuoteCurrency[];
};

export interface MvktRewardsEntry {
  cycle: number;
  balance: number;
  baker: {
    alias?: string;
    address: string;
  };
  stakingBalance: number;
  expectedBlocks: number;
  expectedEndorsements: number;
  futureBlocks: number;
  futureBlockRewards: number;
  ownBlocks: number;
  ownBlockRewards: number;
  extraBlocks: number;
  extraBlockRewards: number;
  missedOwnBlocks: number;
  missedOwnBlockRewards: number;
  missedExtraBlocks: number;
  missedExtraBlockRewards: number;
  uncoveredOwnBlocks: number;
  uncoveredOwnBlockRewards: number;
  uncoveredExtraBlocks: number;
  uncoveredExtraBlockRewards: number;
  futureEndorsements: number;
  futureEndorsementRewards: number;
  endorsements: number;
  endorsementRewards: number;
  missedEndorsements: number;
  missedEndorsementRewards: number;
  uncoveredEndorsements: number;
  uncoveredEndorsementRewards: number;
  ownBlockFees: number;
  extraBlockFees: number;
  missedOwnBlockFees: number;
  missedExtraBlockFees: number;
  uncoveredOwnBlockFees: number;
  uncoveredExtraBlockFees: number;
  doubleBakingRewards: number;
  doubleBakingLostDeposits: number;
  doubleBakingLostRewards: number;
  doubleBakingLostFees: number;
  doubleEndorsingRewards: number;
  doubleEndorsingLostDeposits: number;
  doubleEndorsingLostRewards: number;
  doubleEndorsingLostFees: number;
  revelationRewards: number;
  revelationLostRewards: number;
  revelationLostFees: number;
  quote?: MvktQuote;
}

export type MvktGetRewardsResponse = MvktRewardsEntry[] | undefined;

export interface MvktAccountAsset {
  id: number;
  account: MvktAlias;
  /** Raw value, not divided by `decimals` */
  balance: string;
  firstLevel: number;
  firstTime: string;
  lastLevel: number;
  lastTime: string;
  transfersCount: number;
  token: MvktAssetToken;
}

interface MvktAssetToken {
  id: number;
  contract: MvktAlias;
  standard: 'fa1.2' | 'fa2';
  tokenId: string;
  /**
   * @deprecated // Not always correct information
   */
  metadata?: MvktAssetMetadata;
}

export interface MvktAssetMetadata {
  creators: string[];
  decimals?: string;
  description: string;
  formats: { uri: string; mimeType: string }[];
  isBooleanAmount: boolean;
  name: string;
  shouldPreferSymbol: boolean;
  symbol: string;
  tags: string[];
  thumbnailUri: string;
  displayUri: string;
  artifactUri: string;
}

export interface MvktRWAAssetMetadata {
  decimals?: string;
  address: string;
  slug: string;
  token_id: number;
  description: string;
  name: string;
  shouldPreferSymbol: boolean;
  symbol: string;
  thumbnailUri?: string;
  identifier: string;
}
export interface MvktRWAAssetMetadataResponse {
  address: string;
  token_id: number;
  token_standard: string;
  token_metadata: {
    icon?: string;
    name: string;
    symbol: string;
    decimals?: string;
    assetDetails?: string;
    thumbnailUri?: string;
    shouldPreferSymbol: boolean;
  };
}

export interface MvktTokenTransfer {
  amount: string;
  from: MvktAlias;
  id: number;
  level: number;
  timestamp: string;
  to: MvktAlias;
  token: {
    contract: MvktAlias;
    id: number;
    metadata: {
      name: string;
      symbol: string;
      decimals: string;
      thumbnailUri?: string;
      eth_name?: string;
      eth_symbol?: string;
      eth_contract?: string;
    };
    standard: string;
    tokenId: string;
  };
  transactionId: number;
}

export enum MvktAccountType {
  User = 'user',
  Delegate = 'delegate',
  Contract = 'contract',
  Ghost = 'ghost',
  Rollup = 'rollup',
  SmartRollup = 'smart_rollup',
  Empty = 'empty'
}

interface MvktAccountBase {
  type: MvktAccountType;
  address: string;
  alias: string | nullish;
  balance?: number;
  stakedBalance?: number;
  unstakedBalance?: number;
}

export interface MvktUserAccount extends MvktAccountBase {
  type: MvktAccountType.User;
  id: number;
  publicKey: string;
  revealed: boolean;
  balance: number;
  rollupBonds: number;
  smartRollupBonds: number;
  counter: number;
  delegate: MvktAlias | nullish;
  delegationLevel: number;
  delegationTime: string | nullish;
  numContracts: number;
  rollupsCount: number;
  smartRollupsCount: number;
  activeTokensCount: number;
  tokenBalancesCount: number;
  tokenTransfersCount: number;
  numActivations: number;
  numDelegations: number;
  numOriginations: number;
  numTransactions: number;
  numReveals: number;
  numRegisterConstants: number;
  numSetDepositsLimits: number;
  numMigrations: number;
  txRollupOriginationCount: number;
  txRollupSubmitBatchCount: number;
  txRollupCommitCount: number;
  txRollupReturnBondCount: number;
  txRollupFinalizeCommitmentCount: number;
  txRollupRemoveCommitmentCount: number;
  txRollupRejectionCount: number;
  txRollupDispatchTicketsCount: number;
  transferTicketCount: number;
  increasePaidStorageCount: number;
  drainDelegateCount: number;
  smartRollupAddMessagesCount: number;
  smartRollupCementCount: number;
  smartRollupExecuteCount: number;
  smartRollupOriginateCount: number;
  smartRollupPublishCount: number;
  smartRollupRecoverBondCount: number;
  smartRollupRefuteCount: number;
  refutationGamesCount: number;
  activeRefutationGamesCount: number;
  firstActivity: number | nullish;
  firstActivityTime: string | nullish;
  lastActivity: number | nullish;
  lastActivityTime: string | nullish;
}

interface MvktDelegateAccount extends MvktAccountBase {
  type: MvktAccountType.Delegate;
  id: number;
  active: boolean;
  publicKey: string | nullish;
  revealed: boolean;
  balance: number;
  rollupBonds: number;
  smartRollupBonds: number;
  frozenDepositLimit: number | nullish;
  counter: number;
  activationLevel: number;
  activationTime: string;
  deactivationLevel: number | nullish;
  deactivationTime: string | nullish;
  delegatedBalance: number;
  numContracts: number;
  rollupsCount: number;
  smartRollupsCount: number;
  activeTokensCount: number;
  tokenBalancesCount: number;
  tokenTransfersCount: number;
  numDelegators: number;
  numBlocks: number;
  numEndorsements: number;
  numPreendorsements: number;
  numBallots: number;
  numProposals: number;
  numActivations: number;
  numDoubleBaking: number;
  numDoubleEndorsing: number;
  numDoublePreendorsing: number;
  numNonceRevelations: number;
  vdfRevelationsCount: number;
  numRevelationPenalties: number;
  numEndorsingRewards: number;
  numDelegations: number;
  numOriginations: number;
  numTransactions: number;
  numReveals: number;
  numRegisterConstants: number;
  numSetDepositsLimits: number;
  numMigrations: number;
  txRollupOriginationCount: number;
  txRollupSubmitBatchCount: number;
  txRollupCommitCount: number;
  txRollupReturnBondCount: number;
  txRollupFinalizeCommitmentCount: number;
  txRollupRemoveCommitmentCount: number;
  txRollupRejectionCount: number;
  txRollupDispatchTicketsCount: number;
  transferTicketCount: number;
  increasePaidStorageCount: number;
  updateConsensusKeyCount: number;
  drainDelegateCount: number;
  smartRollupAddMessagesCount: number;
  smartRollupCementCount: number;
  smartRollupExecuteCount: number;
  smartRollupOriginateCount: number;
  smartRollupPublishCount: number;
  smartRollupRecoverBondCount: number;
  smartRollupRefuteCount: number;
  refutationGamesCount: number;
  activeRefutationGamesCount: number;
  firstActivity: number;
  firstActivityTime: string | nullish;
  lastActivity: number;
  lastActivityTime: string | nullish;
  extras: unknown;
  software: { date: string; version: string | nullish };
}

export interface MvktContractAccount extends MvktAccountBase {
  type: MvktAccountType.Contract;
  id: number;
  kind: 'delegator_contract' | 'smart_contract' | nullish;
  tzips: string[] | nullish;
  balance: number;
  creator: MvktAlias | nullish;
  manager: MvktAlias | nullish;
  delegate: MvktAlias | nullish;
  delegationLevel: number | nullish;
  delegationTime: string | nullish;
  numContracts: number;
  activeTokensCount: number;
  tokensCount: number;
  tokenBalancesCount: number;
  tokenTransfersCount: number;
  numDelegations: number;
  numOriginations: number;
  numTransactions: number;
  numReveals: number;
  numMigrations: number;
  transferTicketCount: number;
  increasePaidStorageCount: number;
  eventsCount: number;
  firstActivity: number;
  firstActivityTime: string;
  lastActivity: number;
  lastActivityTime: string;
  typeHash: number;
  codeHash: number;
  /** TZIP-16 metadata (with ?legacy=true this field will contain tzkt profile info). */
  metadata: unknown;
  extras: unknown;
  /** Contract storage value. Omitted by default. Use ?includeStorage=true to include it into response. */
  storage: unknown;
}

interface MvktGhostAccount extends MvktAccountBase {
  type: MvktAccountType.Ghost;
  id: number;
  activeTokensCount: number;
  tokenBalancesCount: number;
  tokenTransfersCount: number;
  firstActivity: number;
  firstActivityTime: string;
  lastActivity: number;
  lastActivityTime: string;
  extras: unknown;
}

interface MvktRollupAccount extends MvktAccountBase {
  type: MvktAccountType.Rollup;
  id: number;
  creator: MvktAlias | nullish;
  rollupBonds: number;
  activeTokensCount: number;
  tokenBalancesCount: number;
  tokenTransfersCount: number;
  numTransactions: number;
  txRollupOriginationCount: number;
  txRollupSubmitBatchCount: number;
  txRollupCommitCount: number;
  txRollupReturnBondCount: number;
  txRollupFinalizeCommitmentCount: number;
  txRollupRemoveCommitmentCount: number;
  txRollupRejectionCount: number;
  txRollupDispatchTicketsCount: number;
  transferTicketCount: number;
  firstActivity: number;
  firstActivityTime: string;
  lastActivity: number;
  lastActivityTime: string;
  extras: unknown;
}

interface MvktSmartRollupAccount extends MvktAccountBase {
  type: MvktAccountType.SmartRollup;
  id: number;
  creator: MvktAlias | nullish;
  pvmKind: 'arith' | 'wasm' | nullish;
  genesisCommitment: string | nullish;
  lastCommitment: string | nullish;
  inboxLevel: number;
  totalStakers: number;
  activeStakers: number;
  executedCommitments: number;
  cementedCommitments: number;
  pendingCommitments: number;
  refutedCommitments: number;
  orphanCommitments: number;
  smartRollupBonds: number;
  activeTokensCount: number;
  tokenBalancesCount: number;
  tokenTransfersCount: number;
  numTransactions: number;
  transferTicketCount: number;
  smartRollupCementCount: number;
  smartRollupExecuteCount: number;
  smartRollupOriginateCount: number;
  smartRollupPublishCount: number;
  smartRollupRecoverBondCount: number;
  smartRollupRefuteCount: number;
  refutationGamesCount: number;
  activeRefutationGamesCount: number;
  firstActivity: number;
  firstActivityTime: string;
  lastActivity: number;
  lastActivityTime: string;
  extras: unknown;
}

interface MvktEmptyAccount extends MvktAccountBase {
  type: MvktAccountType.Empty;
  alias: undefined;
  counter: number;
}

export type MvktAccount =
  | MvktUserAccount
  | MvktDelegateAccount
  | MvktContractAccount
  | MvktGhostAccount
  | MvktRollupAccount
  | MvktSmartRollupAccount
  | MvktEmptyAccount;

export enum MvktSubscriptionStateMessageType {
  Subscribed = 0,
  Data = 1,
  Reorg = 2
}

/** This enum is incomplete */
export enum MvktSubscriptionMethod {
  SubscribeToAccounts = 'SubscribeToAccounts',
  SubscribeToTokenBalances = 'SubscribeToTokenBalances',
  SubscribeToOperations = 'SubscribeToOperations'
}

export enum MvktSubscriptionChannel {
  Accounts = 'accounts',
  TokenBalances = 'token_balances',
  Operations = 'operations'
}

interface SubscribeToAccountsParams {
  addresses: string[];
}

interface SubscribeToTokenBalancesParams {
  account?: string;
  contract?: string;
  tokenId?: string;
}

interface SubscribeToOperationsParams {
  /** address you want to subscribe to, or null if you want to subscribe for all operations */
  address: string | null;
  /** hash of the code of the contract to which the operation is related (can be used with 'transaction',
   * 'origination', 'delegation' types only)
   */
  codeHash?: number;
  types: string;
}

interface MvktSubscriptionMessageCommon {
  type: MvktSubscriptionStateMessageType;
  state: number;
}

interface MvktSubscribedMessage extends MvktSubscriptionMessageCommon {
  type: MvktSubscriptionStateMessageType.Subscribed;
  state: number;
}

interface MvktDataMessage<T> extends MvktSubscriptionMessageCommon {
  type: MvktSubscriptionStateMessageType.Data;
  state: number;
  data: T;
}

interface MvktReorgMessage extends MvktSubscriptionMessageCommon {
  type: MvktSubscriptionStateMessageType.Reorg;
  state: number;
}

type MvktSubscriptionMessage<T> = MvktSubscribedMessage | MvktDataMessage<T> | MvktReorgMessage;

export type MvktAccountsSubscriptionMessage = MvktSubscriptionMessage<MvktAccount[]>;

export type MvktTokenBalancesSubscriptionMessage = MvktSubscriptionMessage<MvktAccountAsset[]>;

type MvktOperationsSubscriptionMessage = MvktSubscriptionMessage<MvktOperation[]>;

export interface MvktHubConnection extends HubConnection {
  invoke(method: MvktSubscriptionMethod.SubscribeToAccounts, params: SubscribeToAccountsParams): Promise<void>;
  invoke(
    method: MvktSubscriptionMethod.SubscribeToTokenBalances,
    params: SubscribeToTokenBalancesParams
  ): Promise<void>;
  invoke(method: MvktSubscriptionMethod.SubscribeToOperations, params: SubscribeToOperationsParams): Promise<void>;

  on(method: MvktSubscriptionChannel.Accounts, cb: (msg: MvktAccountsSubscriptionMessage) => void): void;
  on(method: MvktSubscriptionChannel.TokenBalances, cb: (msg: MvktTokenBalancesSubscriptionMessage) => void): void;
  on(method: MvktSubscriptionChannel.Operations, cb: (msg: MvktOperationsSubscriptionMessage) => void): void;

  off(method: MvktSubscriptionChannel.Accounts): void;
  off(method: MvktSubscriptionChannel.Accounts, cb: (msg: MvktAccountsSubscriptionMessage) => void): void;
  off(method: MvktSubscriptionChannel.TokenBalances): void;
  off(method: MvktSubscriptionChannel.TokenBalances, cb: (msg: MvktTokenBalancesSubscriptionMessage) => void): void;
  off(method: MvktSubscriptionChannel.Operations): void;
  off(method: MvktSubscriptionChannel.Operations, cb: (msg: MvktOperationsSubscriptionMessage) => void): void;
}

export type SetDelegateParametersOperation = {
  type: 'set_delegate_parameters';
  id: number;
  level: number;
  timestamp: string; // ISO date string
  hash: string;
  sender: {
    address: string;
  };
  counter: number;
  gasLimit: number;
  gasUsed: number;
  storageLimit: number;
  bakerFee: number;
  limitOfStakingOverBaking: number;
  edgeOfBakingOverStaking: number;
  activationCycle: number;
  status: OperationStatus;
};
