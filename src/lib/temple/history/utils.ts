import { Estimate, TransactionOperation, WalletOperation } from '@mavrykdynamics/webmavryk';
import { BigNumber } from 'bignumber.js';
import dayjs from 'dayjs';

import { isKnownChainId } from 'lib/apis/tzkt';
import type { TzktAlias, TzktApiChainId, TzktOperation, TzktTransactionOperation } from 'lib/apis/tzkt';
import {
  isTzktOperParam,
  isTzktOperParam_Fa12,
  isTzktOperParam_Fa2,
  isTzktOperParam_LiquidityBaking,
  ParameterFa2
} from 'lib/apis/tzkt/utils';
import { fetchFromStorage, putToStorage } from 'lib/storage';
import { mumavToTz, tzToMumav } from 'lib/temple/helpers';
import { isTruthy } from 'lib/utils';
import type { MavrykHistoryNetworkFees, MavrykHistoryOperation, MavrykHistoryOperationDetails } from 'mavryk/api/history';

import { MAV_TOKEN_SLUG, toTokenSlug } from '../../assets';
import type { AssetMetadataBase } from '../../metadata';

import { getMoneyDiff, isZero } from './helpers';
import {
  Fa2TransferSummaryArray,
  HistoryDisplayMoneyDiff,
  HistoryItemDelegationOp,
  HistoryItemOperationBase,
  HistoryItemOpReveal,
  HistoryItemOpTypeEnum,
  HistoryItemOriginationOp,
  HistoryItemOtherOp,
  HistoryItemStakingOp,
  HistoryItemStatus,
  HistoryItemTokenTransfer,
  HistoryItemTransactionOp,
  HistoryMember,
  IndividualHistoryItem,
  OperationsGroup,
  RecipientInfo,
  StakingActions,
  TokenType,
  UserHistoryItem
} from './types';

type BackendHistoryNormalizationContext = {
  address: string;
  assetSlug?: string;
};

type MavrykHistoryOperationsGroup = {
  hash: string;
  operations: MavrykHistoryOperation[];
  summaryOperation?: MavrykHistoryOperation;
};

const MVRK_CURRENCY = 'MVRK';
const BACKEND_SUMMARY_DIFF_TYPES = new Set<HistoryItemOpTypeEnum>([
  HistoryItemOpTypeEnum.Interaction,
  HistoryItemOpTypeEnum.Multiple,
  HistoryItemOpTypeEnum.TransferTo,
  HistoryItemOpTypeEnum.TransferFrom
]);

const backendNumberToMumav = (value?: number) => tzToMumav(value ?? 0).toNumber();
const getBackendOperationTimestamp = (operation: MavrykHistoryOperation) =>
  operation.details?.timestamp ?? operation.timestamp ?? '';

const getBackendOperationEntrypoint = (operation: MavrykHistoryOperation) =>
  operation.details?.entrypoint ?? operation.parameter?.entrypoint;

const getBackendOperationId = (operation: MavrykHistoryOperation, fallback = 0) => operation.id ?? fallback;
const getBackendOperationType = (operation: MavrykHistoryOperation) => operation.details?.type ?? operation.type;
const isBackendMavCurrency = (currency?: string) => {
  const normalizedCurrency = currency?.toUpperCase();

  return normalizedCurrency === MVRK_CURRENCY || normalizedCurrency === 'MAV';
};

const normalizeBackendContractAddress = (contractAddress?: string, currency?: string) => {
  if (isBackendMavCurrency(currency)) return MAV_TOKEN_SLUG;

  return contractAddress;
};

const getBackendOperationKey = (operation: MavrykHistoryOperation) =>
  [
    operation.hash,
    getBackendOperationId(operation, -1),
    operation.type,
    operation.role ?? '',
    operation.counter ?? '',
    getBackendOperationTimestamp(operation),
    operation.sender ?? '',
    operation.target ?? ''
  ].join(':');

const getNestedBackendOperations = (operation: MavrykHistoryOperation): MavrykHistoryOperation[] => {
  if (!operation.operations?.length) {
    return [operation];
  }

  return operation.operations.flatMap(childOperation => getNestedBackendOperations(childOperation));
};

export const groupMavrykHistoryOperations = (operations: MavrykHistoryOperation[]): MavrykHistoryOperationsGroup[] => {
  const groupedOperations = new Map<string, MavrykHistoryOperationsGroup>();
  const groupOrder: string[] = [];
  const operationKeys = new Map<string, Set<string>>();

  operations.forEach(operation => {
    if (!groupedOperations.has(operation.hash)) {
      groupedOperations.set(operation.hash, {
        hash: operation.hash,
        operations: [],
        summaryOperation: operation.operations?.length ? operation : undefined
      });
      operationKeys.set(operation.hash, new Set());
      groupOrder.push(operation.hash);
    }

    const group = groupedOperations.get(operation.hash);
    const groupOperationKeys = operationKeys.get(operation.hash);
    const normalizedOperations = getNestedBackendOperations(operation);

    if (!group || !groupOperationKeys) {
      return;
    }

    if (operation.operations?.length && !group.summaryOperation) {
      group.summaryOperation = operation;
    }

    normalizedOperations.forEach(normalizedOperation => {
      const operationKey = getBackendOperationKey(normalizedOperation);

      if (groupOperationKeys.has(operationKey)) {
        return;
      }

      groupOperationKeys.add(operationKey);
      group.operations.push(normalizedOperation);
    });
  });

  return groupOrder
    .map(hash => groupedOperations.get(hash))
    .filter((group): group is MavrykHistoryOperationsGroup => Boolean(group));
};

const normalizeBackendFees = (fees?: MavrykHistoryNetworkFees) => {
  if (!fees) return undefined;

  return {
    totalFee: fees.totalFee,
    gasFee: fees.gasFee,
    storageFee: fees.storageFee,
    burnedFromFees: fees.burnedFromFees,
    usdAmount: fees.usdAmount
  };
};

const buildBackendOperationBase = (
  operation: MavrykHistoryOperation,
  address: string,
  amount: number,
  source: HistoryMember,
  index: number
): HistoryItemOperationBase => {
  const networkFees = normalizeBackendFees(operation.networkFees);
  const reducedOperation: HistoryItemOperationBase = {
    id: getBackendOperationId(operation, index),
    level: operation.level ?? 0,
    source,
    amountSigned: getBackendAmountSigned(operation, address, amount, source),
    status: stringToHistoryItemStatus(operation.status),
    addedAt: getBackendOperationTimestamp(operation),
    block: operation.block ?? '',
    hash: operation.hash,
    isHighlighted: false,
    opIndex: index,
    bakerFee: backendNumberToMumav(networkFees?.gasFee),
    gasUsed: operation.gasUsed ?? 0,
    storageUsed: operation.storageUsed ?? 0,
    storageFee: backendNumberToMumav(networkFees?.storageFee),
    entrypoint: getBackendOperationEntrypoint(operation),
    networkFees
  };

  if (!isZero(reducedOperation.amountSigned)) reducedOperation.amountDiff = getMoneyDiff(reducedOperation.amountSigned);

  return reducedOperation;
};

const getBackendTokenContext = (assetSlug?: string) => {
  if (!assetSlug || assetSlug === MAV_TOKEN_SLUG) return null;

  const [contractAddress, tokenIdRaw] = assetSlug.split('_');
  return {
    contractAddress,
    tokenId: Number(tokenIdRaw ?? '0')
  };
};

const getBackendHistoryMember = (operation: MavrykHistoryOperation) =>
  transformToHistoryMember(operation.details?.from ?? operation.parameter?.from ?? operation.sender ?? '');

const getBackendAmountSigned = (
  operation: MavrykHistoryOperation,
  address: string,
  amount: number,
  source: HistoryMember
) =>
  getAmountSigned(
    {
      type: getBackendOperationType(operation) as TzktOperation['type'],
      sender: source,
      baker: undefined
    } as TzktOperation,
    address,
    amount,
    source
  );

const buildBackendSummaryDisplayMoneyDiffs = (
  group: MavrykHistoryOperationsGroup,
  type: HistoryItemOpTypeEnum,
  context: BackendHistoryNormalizationContext
): HistoryDisplayMoneyDiff[] | undefined => {
  const summaryOperation = group.summaryOperation;
  if (!summaryOperation || !BACKEND_SUMMARY_DIFF_TYPES.has(type)) return undefined;

  const tokenContext = getBackendTokenContext(context.assetSlug);
  const details = summaryOperation.details ?? undefined;
  const amount = details?.amount ?? summaryOperation.amount;

  if (amount == null) return undefined;

  // API history amounts are already normalized display units. Never recompute them from nested raw operations.
  const contractAddress = normalizeBackendContractAddress(
    details?.tokenAddress ?? tokenContext?.contractAddress,
    details?.currency
  );

  if (!contractAddress) return undefined;

  const tokenId = details?.tokenId ?? tokenContext?.tokenId ?? 0;
  const assetSlug = contractAddress === MAV_TOKEN_SLUG ? MAV_TOKEN_SLUG : toTokenSlug(contractAddress, tokenId);
  const source = getBackendHistoryMember(summaryOperation);
  const diff = getMoneyDiff(getBackendAmountSigned(summaryOperation, context.address, amount, source));

  return [{ assetSlug, diff }];
};

const buildBackendTokenTransfer = (
  operation: Pick<MavrykHistoryOperation, 'id' | 'level'>,
  contractAddress: string,
  tokenId: number,
  source: HistoryMember,
  destination: HistoryMember,
  amount: number
): HistoryItemTokenTransfer => ({
  totalAmount: String(amount),
  recipients: [{ to: destination, amount: String(amount) }],
  id: operation.id ?? 0,
  level: operation.level ?? 0,
  sender: source,
  tokenContractAddress: contractAddress,
  tokenId,
  tokenType: 'fa2',
  assetSlug: toTokenSlug(contractAddress, tokenId)
});

const buildBackendFa2TokenTransfer = (
  operation: MavrykHistoryOperation,
  contractAddress: string,
  address: string
): HistoryItemTokenTransfer | null => {
  const parameter = operation.parameter;
  if (!isTzktOperParam_Fa2(parameter)) return null;

  const values = reduceParameterFa2Values(parameter.value, address);
  const firstValue = values[0];
  if (!firstValue) return null;

  return {
    totalAmount: firstValue.totalAmount,
    recipients: firstValue.recipients,
    id: operation.id ?? 0,
    level: operation.level ?? 0,
    sender: transformToHistoryMember(firstValue.from),
    tokenContractAddress: contractAddress,
    tokenId: Number(firstValue.tokenId),
    tokenType: 'fa2',
    assetSlug: toTokenSlug(contractAddress, Number(firstValue.tokenId))
  };
};

const buildBackendTransferType = (
  source: HistoryMember,
  address: string,
  details?: MavrykHistoryOperationDetails
): HistoryItemOpTypeEnum => {
  if (details?.transferType === 'received') return HistoryItemOpTypeEnum.TransferFrom;
  if (details?.transferType === 'sent') return HistoryItemOpTypeEnum.TransferTo;

  return source.address === address ? HistoryItemOpTypeEnum.TransferTo : HistoryItemOpTypeEnum.TransferFrom;
};

const buildBackendTransactionOperation = (
  operation: MavrykHistoryOperation,
  index: number,
  context: BackendHistoryNormalizationContext,
  args: {
    amount: number;
    source: HistoryMember;
    destination: HistoryMember;
    contractAddress?: string;
    tokenTransfers?: HistoryItemTokenTransfer;
    details?: MavrykHistoryOperationDetails;
  }
): HistoryItemTransactionOp => {
  const { address } = context;
  const { amount, source, destination, contractAddress, tokenTransfers, details } = args;
  const txBase = buildBackendOperationBase(operation, address, amount, source, index);
  const entrypoint = getBackendOperationEntrypoint(operation);
  const isInteraction = Boolean(entrypoint && entrypoint !== 'transfer');
  const historyTxOp: HistoryItemTransactionOp = {
    ...txBase,
    destination,
    type: isInteraction ? HistoryItemOpTypeEnum.Interaction : buildBackendTransferType(source, address, details),
    assetSlug: MAV_TOKEN_SLUG
  };

  if (entrypoint) historyTxOp.entrypoint = entrypoint;

  if (tokenTransfers) {
    historyTxOp.tokenTransfers = tokenTransfers;
    historyTxOp.contractAddress = tokenTransfers.tokenContractAddress;
    historyTxOp.assetSlug = tokenTransfers.assetSlug;
  } else if (contractAddress && contractAddress !== MAV_TOKEN_SLUG) {
    historyTxOp.contractAddress = contractAddress;
    historyTxOp.assetSlug = toTokenSlug(contractAddress, 0);
  } else {
    historyTxOp.contractAddress = MAV_TOKEN_SLUG;
    historyTxOp.assetSlug = MAV_TOKEN_SLUG;
  }

  return historyTxOp;
};

const deriveBackendItemType = (
  group: MavrykHistoryOperationsGroup,
  items: IndividualHistoryItem[],
  address: string,
  mainOperation?: IndividualHistoryItem
): HistoryItemOpTypeEnum => {
  const summaryOperation = group.summaryOperation;
  const summaryType = summaryOperation?.details?.type;
  const summaryEntrypoint = summaryOperation?.details?.entrypoint;
  const summaryTransferType = summaryOperation?.details?.transferType;

  if (summaryType === 'other') return HistoryItemOpTypeEnum.Other;
  if (summaryType === 'delegation') return HistoryItemOpTypeEnum.Delegation;
  if (summaryType === 'staking') return HistoryItemOpTypeEnum.Staking;
  if (summaryType === 'origination') return HistoryItemOpTypeEnum.Origination;
  if (summaryType === 'reveal') return HistoryItemOpTypeEnum.Reveal;

  if (summaryEntrypoint?.toLowerCase() === 'swap') return HistoryItemOpTypeEnum.Swap;
  if (summaryEntrypoint === 'placeSellOrder' || summaryEntrypoint === 'placeBuyOrder') {
    return HistoryItemOpTypeEnum.Multiple;
  }
  if (summaryTransferType === 'sent') return HistoryItemOpTypeEnum.TransferTo;
  if (summaryTransferType === 'received') return HistoryItemOpTypeEnum.TransferFrom;
  if (summaryEntrypoint && summaryEntrypoint !== 'transfer') return HistoryItemOpTypeEnum.Interaction;

  const firstOperation = group.operations[0] ?? summaryOperation;
  const firstItem = items[0];

  if (!firstOperation) return HistoryItemOpTypeEnum.Other;
  const firstOperationType = getBackendOperationType(firstOperation);
  if (firstOperationType === 'other') return HistoryItemOpTypeEnum.Other;
  if (firstOperationType === 'delegation') return HistoryItemOpTypeEnum.Delegation;
  if (firstOperationType === 'staking') return HistoryItemOpTypeEnum.Staking;
  if (firstOperationType === 'origination') return HistoryItemOpTypeEnum.Origination;
  if (firstOperationType === 'reveal') return HistoryItemOpTypeEnum.Reveal;

  if (items.some(item => item.entrypoint?.toLowerCase() === 'swap')) return HistoryItemOpTypeEnum.Swap;
  if (items.some(item => item.entrypoint === 'placeSellOrder' || item.entrypoint === 'placeBuyOrder')) {
    return HistoryItemOpTypeEnum.Multiple;
  }

  if (!firstItem) return mainOperation?.type ?? HistoryItemOpTypeEnum.Other;

  if (firstOperation.details?.transferType === 'sent' && items.length === 1) {
    return HistoryItemOpTypeEnum.TransferTo;
  }
  if (firstOperation.details?.transferType === 'received' && items.length === 1) {
    return HistoryItemOpTypeEnum.TransferFrom;
  }

  if (
    firstItem.source.address === address &&
    firstItem.type === HistoryItemOpTypeEnum.TransferTo &&
    items.length === 1
  ) {
    return HistoryItemOpTypeEnum.TransferTo;
  }

  if (items.some(item => item.entrypoint !== undefined && item.entrypoint !== 'transfer')) {
    return HistoryItemOpTypeEnum.Interaction;
  }

  if ('tokenTransfers' in firstItem && firstItem.tokenTransfers && items.length === 1) {
    return firstItem.tokenTransfers.recipients?.find(recipient => recipient.to.address === address)
      ? HistoryItemOpTypeEnum.TransferFrom
      : HistoryItemOpTypeEnum.TransferTo;
  }

  if (
    firstItem.type === HistoryItemOpTypeEnum.TransferTo &&
    firstItem.source.address !== address &&
    items.length === 1
  ) {
    return HistoryItemOpTypeEnum.TransferFrom;
  }

  if (firstItem.type && items.length === 1) {
    return firstItem.type;
  }

  return HistoryItemOpTypeEnum.Interaction;
};

const reduceOneBackendOperation = (
  operation: MavrykHistoryOperation,
  index: number,
  context: BackendHistoryNormalizationContext
): IndividualHistoryItem | null => {
  const { address, assetSlug } = context;
  const tokenContext = getBackendTokenContext(assetSlug);
  const details = operation.details ?? undefined;
  const effectiveOperationType = getBackendOperationType(operation);
  const sourceAddress = details?.from ?? operation.parameter?.from ?? operation.sender ?? '';
  const destinationAddress = details?.to ?? details?.contract ?? operation.parameter?.to ?? operation.target ?? '';
  const source = transformToHistoryMember(sourceAddress);
  const destination = transformToHistoryMember(destinationAddress);
  const amount = details?.amount ?? operation.amount ?? operation.parameter?.amount ?? 0;
  const detailsContractAddress = normalizeBackendContractAddress(details?.tokenAddress, details?.currency);

  switch (effectiveOperationType) {
    case 'delegation': {
      const delegationOpBase = buildBackendOperationBase(operation, address, 0, source, index);

      return {
        ...delegationOpBase,
        type: HistoryItemOpTypeEnum.Delegation,
        prevDelegate:
          operation.prevDelegate || details?.prevDelegate
            ? transformToHistoryMember(operation.prevDelegate ?? details?.prevDelegate ?? '')
            : null,
        newDelegate:
          operation.newDelegate || details?.newDelegate
            ? transformToHistoryMember(operation.newDelegate ?? details?.newDelegate ?? '')
            : destinationAddress
            ? destination
            : null
      };
    }
    case 'staking': {
      const stakingOpBase = buildBackendOperationBase(operation, address, amount, source, index);

      return {
        ...stakingOpBase,
        amount,
        action: (details?.action ?? operation.action ?? operation.parameter?.entrypoint ?? 'stake') as StakingActions,
        sender: source,
        baker:
          operation.baker || details?.baker
            ? transformToHistoryMember(operation.baker ?? details?.baker ?? '')
            : destinationAddress
            ? destination
            : null,
        type: HistoryItemOpTypeEnum.Staking
      };
    }
    case 'origination': {
      const contractBalance = String(details?.contractBalance ?? operation.contractBalance ?? 0);
      const originationOpBase = buildBackendOperationBase(operation, address, Number(contractBalance), source, index);
      const originatedContract = operation.originatedContract ?? details?.originatedContract;

      return {
        ...originationOpBase,
        originatedContract: originatedContract ? transformToHistoryMember(originatedContract) : undefined,
        contractBalance,
        type: HistoryItemOpTypeEnum.Origination
      };
    }
    case 'reveal': {
      const revealOpBase = buildBackendOperationBase(operation, address, 0, source, index);

      return {
        ...revealOpBase,
        type: HistoryItemOpTypeEnum.Reveal
      };
    }
    case 'interaction':
    case 'transaction':
    case 'transfer': {
      if (details) {
        const tokenId = details.tokenId ?? tokenContext?.tokenId ?? 0;
        const tokenTransfers =
          detailsContractAddress && detailsContractAddress !== MAV_TOKEN_SLUG
            ? buildBackendTokenTransfer(operation, detailsContractAddress, tokenId, source, destination, amount)
            : undefined;

        return buildBackendTransactionOperation(operation, index, context, {
          amount,
          source,
          destination,
          contractAddress: detailsContractAddress ?? MAV_TOKEN_SLUG,
          tokenTransfers,
          details
        });
      }

      const parameter = operation.parameter;

      if (isTzktOperParam_Fa2(parameter)) {
        const contractAddress = normalizeBackendContractAddress(operation.target ?? tokenContext?.contractAddress);
        if (!contractAddress) return null;

        const tokenTransfers =
          contractAddress === MAV_TOKEN_SLUG ? null : buildBackendFa2TokenTransfer(operation, contractAddress, address);
        const txSource = tokenTransfers?.sender ?? source;
        const txDestination = tokenTransfers?.recipients?.[0]?.to ?? destination;
        const txAmount = Number(tokenTransfers?.totalAmount ?? amount);

        return buildBackendTransactionOperation(operation, index, context, {
          amount: txAmount,
          source: txSource,
          destination: txDestination,
          contractAddress,
          tokenTransfers: tokenTransfers ?? undefined
        });
      }

      if (isTzktOperParam_Fa12(parameter)) {
        if (parameter.entrypoint === 'approve') return null;

        const contractAddress = normalizeBackendContractAddress(operation.target ?? tokenContext?.contractAddress);
        if (!contractAddress) return null;

        const txSource = transformToHistoryMember(parameter.value.from);
        const txDestination = transformToHistoryMember(parameter.value.to);
        const txAmount = Number(parameter.value.value);
        const tokenTransfers =
          contractAddress === MAV_TOKEN_SLUG
            ? undefined
            : buildBackendTokenTransfer(operation, contractAddress, 0, txSource, txDestination, txAmount);

        return buildBackendTransactionOperation(operation, index, context, {
          amount: txAmount,
          source: txSource,
          destination: txDestination,
          contractAddress,
          tokenTransfers
        });
      }

      const contractAddress = normalizeBackendContractAddress(
        tokenContext?.contractAddress ?? (effectiveOperationType === 'transfer' ? operation.target : undefined)
      );
      const tokenTransfers =
        contractAddress && contractAddress !== MAV_TOKEN_SLUG
          ? buildBackendTokenTransfer(
              operation,
              contractAddress,
              tokenContext?.tokenId ?? 0,
              source,
              destination,
              amount
            )
          : undefined;

      return buildBackendTransactionOperation(operation, index, context, {
        amount,
        source,
        destination,
        contractAddress: contractAddress ?? MAV_TOKEN_SLUG,
        tokenTransfers
      });
    }
    default: {
      const otherOpBase = buildBackendOperationBase(operation, address, 0, source, index);

      return {
        ...otherOpBase,
        destination: destination.address ? destination : undefined,
        type: HistoryItemOpTypeEnum.Other,
        name: effectiveOperationType
      };
    }
  }
};

export function mavrykHistoryGroupToHistoryItem(
  group: MavrykHistoryOperationsGroup,
  context: BackendHistoryNormalizationContext
): UserHistoryItem {
  const operations = [...group.operations];
  const primaryOperation = group.summaryOperation ?? operations[0];
  // API parent operations carry the main details for top-level history UI; nested child ops are low-level stack entries.
  const mainOperation =
    group.summaryOperation?.details != null
      ? reduceOneBackendOperation(group.summaryOperation, 0, context) ?? undefined
      : undefined;
  const historyItemOperations = operations
    .map((operation, index) => reduceOneBackendOperation(operation, index, context))
    .filter(isTruthy);

  const status = deriveHistoryItemStatus(
    historyItemOperations.length
      ? historyItemOperations
      : [{ status: primaryOperation ? stringToHistoryItemStatus(primaryOperation.status) : 'failed' }]
  );
  const type = deriveBackendItemType(group, historyItemOperations, context.address, mainOperation);
  const displayMoneyDiffs = buildBackendSummaryDisplayMoneyDiffs(group, type, context);
  const firstOperation = historyItemOperations[0];
  const oldestOperation = historyItemOperations[historyItemOperations.length - 1];

  return {
    type,
    hash: group.hash,
    addedAt:
      mainOperation?.addedAt ?? firstOperation?.addedAt ?? (primaryOperation ? getBackendOperationTimestamp(primaryOperation) : ''),
    status,
    operations: historyItemOperations,
    mainOperation,
    displayMoneyDiffs,
    hideOperationMoneyDiffs: displayMoneyDiffs ? true : undefined,
    highlightedOperationIndex: 0,
    isGroupedOp: Boolean(group.summaryOperation) || historyItemOperations.length > 1,
    firstOperation,
    oldestOperation
  };
}

export function operationsGroupToHistoryItem({ hash, operations }: OperationsGroup, address: string): UserHistoryItem {
  // TODO: This returns a userHistoryItem. Missing the money diffs. See the JIRA task.
  let firstOperation = undefined,
    oldestOperation = undefined;

  if (operations[0]) {
    firstOperation = reduceOneTzktOperation(operations[0], 0, address);
  }
  if (operations[operations.length - 1]) {
    oldestOperation = reduceOneTzktOperation(operations[operations.length - 1], operations.length - 1, address);
  }

  const historyItemOperations = reduceTzktOperations(operations, address);

  const status = deriveHistoryItemStatus(!historyItemOperations.length ? operations : historyItemOperations);
  const type = deriveHistoryItemType(historyItemOperations, address, operations[0]);

  const newUserHistoryItem: UserHistoryItem = {
    type,
    hash,
    addedAt: firstOperation ? firstOperation.addedAt : '',
    status,
    operations: historyItemOperations,
    highlightedOperationIndex: 0,
    isGroupedOp: historyItemOperations.length > 1
  };

  if (firstOperation) newUserHistoryItem.firstOperation = firstOperation;
  if (oldestOperation) newUserHistoryItem.oldestOperation = oldestOperation;
  return newUserHistoryItem;
}

function reduceTzktOperations(operations: TzktOperation[], address: string): IndividualHistoryItem[] {
  const reducedOperations = operations.map((op, index) => reduceOneTzktOperation(op, index, address)).filter(isTruthy);

  return reducedOperations;
}

/**
 * (i) Does not mutate operation object
 * works with original operation type, nit the custom one like interaction, multiole etc. from the enum
 */
function reduceOneTzktOperation(
  operation: TzktOperation,
  index: number,
  address: string
): IndividualHistoryItem | null {
  switch (operation.type) {
    case 'transaction':
      return reduceOneTzktTransactionOperation(address, operation, index);

    case 'staking':
      const stakingOpBase = buildHistoryItemOpBase(operation, address, operation.amount || 0, operation.sender, index);
      const stakingOp: HistoryItemStakingOp = {
        ...stakingOpBase,
        action: operation.action,
        sender: operation.sender,
        type: HistoryItemOpTypeEnum.Staking,
        baker: operation.baker
      };
      return stakingOp;
    case 'delegation': {
      const delegationOpBase = buildHistoryItemOpBase(operation, address, 0, operation.sender, index);
      const delegationOp: HistoryItemDelegationOp = {
        ...delegationOpBase,
        type: HistoryItemOpTypeEnum.Delegation
      };
      if (operation.newDelegate) delegationOp.newDelegate = operation.newDelegate;
      if (operation.newDelegate) delegationOp.prevDelegate = operation.prevDelegate;
      return delegationOp;
    }
    case 'origination': {
      const source = operation.sender;
      const contractBalance = operation.contractBalance ? operation.contractBalance.toString() : '0';
      const originationOpBase = buildHistoryItemOpBase(operation, address, Number(contractBalance), source, index);
      const originationOp: HistoryItemOriginationOp = {
        ...originationOpBase,
        type: HistoryItemOpTypeEnum.Origination
      };
      if (operation.originatedContract) originationOp.originatedContract = operation.originatedContract;
      return originationOp;
    }
    case 'reveal': {
      const revealOpBase = buildHistoryItemOpBase(operation, address, 0, operation.sender, index);

      const revealOp: HistoryItemOpReveal = {
        ...revealOpBase,
        type: HistoryItemOpTypeEnum.Reveal
      };
      return revealOp;
    }
    default:
      const source = operation.sender;
      const otherOpBase = buildHistoryItemOpBase(operation, address, 0, source, index);
      const otherOp: HistoryItemOtherOp = {
        ...otherOpBase,
        type: HistoryItemOpTypeEnum.Other,
        name: operation.type
      };
      return otherOp;
  }
}

function reduceOneTzktTransactionOperation(
  address: string,
  operation: TzktTransactionOperation,
  index: number
): HistoryItemTransactionOp | null {
  function _buildReturn(args: {
    amount: string;
    source: HistoryMember;
    contractAddress?: string;
    tokenTransfers?: HistoryItemTokenTransfer;
  }) {
    const { amount, source, contractAddress, tokenTransfers } = args;
    const HistoryOpBase = buildHistoryItemOpBase(operation, address, Number(amount), source, index);
    const metadata: AssetMetadataBase = {
      decimals: 0,
      name: '',
      symbol: ''
    };

    const historyTxOp: HistoryItemTransactionOp = {
      ...HistoryOpBase,
      destination: getDestinationAddress(operation),
      assetSlug: '',
      assetMetadata: metadata,
      type: HistoryItemOpTypeEnum.TransferTo
    };
    if (contractAddress != null) historyTxOp.contractAddress = contractAddress;
    if (isTzktOperParam(operation.parameter)) {
      historyTxOp.entrypoint = operation.parameter.entrypoint;
      historyTxOp.type = HistoryItemOpTypeEnum.Interaction;
    }
    if (tokenTransfers) {
      historyTxOp.tokenTransfers = tokenTransfers;
      const { sender, tokenContractAddress, tokenId } = tokenTransfers;

      historyTxOp.assetSlug = toTokenSlug(tokenContractAddress, tokenId);

      if (sender.address === address || !historyTxOp.entrypoint?.toLowerCase()?.includes('swap')) {
        historyTxOp.type = HistoryItemOpTypeEnum.TransferTo;
      } else if (historyTxOp.entrypoint?.toLowerCase()?.includes('swap')) {
        historyTxOp.type = HistoryItemOpTypeEnum.Swap;
      } else historyTxOp.type = HistoryItemOpTypeEnum.TransferFrom;
    }

    return historyTxOp;
  }

  const parameter = operation.parameter;

  if (parameter == null) {
    if (operation.target.address !== address && operation.sender.address !== address) return null;

    const source = operation.sender;
    const amount = String(operation.amount);
    const tokenTransfers = buildTokenTransferItem(operation, MAV_TOKEN_SLUG, address);

    if (!tokenTransfers) return _buildReturn({ amount, source });

    return _buildReturn({
      amount,
      source,
      contractAddress: MAV_TOKEN_SLUG,
      tokenTransfers
    });
  } else if (isTzktOperParam_Fa2(parameter)) {
    const tokenTransfers = buildTokenTransferItem(operation, 'fa2', address);
    // console.log('FA2 - Got to here in buildTokenTransferItem. Hash & Op:', operation.hash, operation, tokenTransfers);
    const source = tokenTransfers?.sender.address === address ? { ...operation.sender, address } : operation.sender;
    const contractAddress = operation.target.address;
    const amount = tokenTransfers?.totalAmount || '0';

    if (!tokenTransfers) return _buildReturn({ amount, source, contractAddress });

    return _buildReturn({ amount, source, contractAddress, tokenTransfers });
  } else if (isTzktOperParam_Fa12(parameter)) {
    if (parameter.entrypoint === 'approve') return null;

    const source = { ...operation.sender };
    if (parameter.value.from === address) source.address = address;
    else if (parameter.value.to === address) source.address = parameter.value.from;
    else return null;

    const contractAddress = operation.target.address;
    const amount = parameter.value.value;
    const tokenTransfers = buildTokenTransferItem(operation, 'fa12', address);

    if (!tokenTransfers) return _buildReturn({ amount, source, contractAddress });

    return _buildReturn({ amount, source, contractAddress, tokenTransfers });
  } else if (isTzktOperParam_LiquidityBaking(parameter)) {
    const source = operation.sender;
    const contractAddress = operation.target.address;
    const amount = parameter.value.quantity;

    return _buildReturn({ amount, source, contractAddress });
  } else {
    const source = operation.sender;
    const amount = String(operation.amount);

    return _buildReturn({ amount, source });
  }
}

// Money utils ------------------------------------------
function getDelegationAmountSigned(operation: TzktOperation, address: string, amount: number) {
  return operation.type === 'delegation' &&
    operation.newDelegate?.address !== address &&
    operation.prevDelegate?.address === address
    ? `-${amount}`
    : `${amount}`;
}

function getStakingAmountSigned(operation: TzktOperation, address: string, amount: number) {
  if (operation.type !== 'staking') return '';
  let isMinus: boolean;
  const isValidator = address === operation.baker?.address;

  switch (operation.action) {
    case StakingActions.stake:
      isMinus = !isValidator; // account (-), validator (+)
      break;

    case StakingActions.unstake:
      isMinus = isValidator; // account (+), validator (-)
      break;

    case StakingActions.restake:
      isMinus = !isValidator; // account (-), validator (+)
      break;

    case StakingActions.finalize:
      isMinus = isValidator; // account (+), validator (-)
      break;

    case StakingActions.slash_staked:
    case StakingActions.slash_unstaked:
      isMinus = true; // account (-), validator (-)
      break;

    default:
      isMinus = false;
  }

  return `${isMinus ? '-' : ''}${amount}`;
}

function getAmountSigned(operation: TzktOperation, address: string, amount: number, source: HistoryMember) {
  if (operation.type === 'delegation') return getDelegationAmountSigned(operation, address, amount);

  if (operation.type === 'staking') return getStakingAmountSigned(operation, address, amount);

  return source.address === address ? `-${amount}` : `${amount}`;
}

// END OF Money utils ------------------------------------------

function buildHistoryItemOpBase(
  operation: TzktOperation,
  address: string,
  amount: number,
  source: HistoryMember,
  index: number
): HistoryItemOperationBase {
  const { id, level, timestamp: addedAt, hash, block, bakerFee, storageFee, gasUsed, storageUsed = 0 } = operation;
  const reducedOperation: HistoryItemOperationBase = {
    id,
    level,
    source,
    amountSigned: getAmountSigned(operation, address, amount, source),
    status: stringToHistoryItemStatus(operation.status),
    addedAt,
    block,
    hash,
    isHighlighted: false,
    opIndex: index,
    bakerFee, // gas fee
    gasUsed,
    storageUsed,
    storageFee: storageFee ?? 0, // storage fee
    entrypoint: (operation as TzktTransactionOperation).entrypoint
  };
  if (!isZero(reducedOperation.amountSigned)) reducedOperation.amountDiff = getMoneyDiff(reducedOperation.amountSigned);
  return reducedOperation;
}

/**
 * Items with zero cumulative amount value are filtered out
 */
function reduceParameterFa2Values(values: ParameterFa2['value'], relAddress: string): Fa2TransferSummaryArray {
  const result: Fa2TransferSummaryArray = [];
  try {
    for (const val of values) {
      const from = val.from_;
      const tokenId = val.txs[0].token_id;

      if (val.from_ === relAddress) {
        let totalAmount = new BigNumber(0);
        const recipients: RecipientInfo[] = [];

        for (const tx of val.txs) {
          const amount = new BigNumber(tx.amount);
          totalAmount = totalAmount.plus(amount);
          recipients.push({
            to: transformToHistoryMember(tx.to_),
            amount: amount.toFixed().toString()
          });
        }

        if (!totalAmount.isZero()) {
          result.push({
            from,
            totalAmount: totalAmount.toFixed().toString(),
            tokenId,
            recipients
          });
        }
      } else {
        let isValRel = false;
        let amount = new BigNumber(0);

        for (const tx of val.txs) {
          if (tx.to_ === relAddress) {
            amount = amount.plus(tx.amount);
            if (!isValRel) isValRel = true;
          }
        }

        if (isValRel && !amount.isZero()) {
          result.push({
            from,
            totalAmount: amount.toFixed().toString(),
            tokenId,
            recipients: [{ to: transformToHistoryMember(relAddress), amount: amount.toFixed().toString() }]
          });
        }
      }
    }
  } catch (e) {
    console.log(values);
  }

  return result;
}

function stringToHistoryItemStatus(status: string): HistoryItemStatus {
  if (['applied', 'backtracked', 'skipped', 'failed'].includes(status)) return status as HistoryItemStatus;

  return 'pending';
}

function deriveHistoryItemStatus(items: { status: HistoryItemStatus }[]): HistoryItemStatus {
  if (items.find(o => o.status === 'pending')) return 'pending';
  if (items.find(o => o.status === 'applied')) return 'applied';
  if (items.find(o => o.status === 'backtracked')) return 'backtracked';
  if (items.find(o => o.status === 'skipped')) return 'skipped';
  if (items.find(o => o.status === 'failed')) return 'failed';

  return items[0]!.status;
}

function deriveHistoryItemType(
  items: IndividualHistoryItem[], // [5, 2]
  address: string,
  firstOperation: TzktOperation // 5
): HistoryItemOpTypeEnum {
  let type = HistoryItemOpTypeEnum.Interaction;

  // Need to find the first transaction that isn't an approval
  // then need to take that opp type.
  if (firstOperation.type === 'other') {
    return HistoryItemOpTypeEnum.Other;
  } else if (firstOperation.type === 'delegation') {
    return HistoryItemOpTypeEnum.Delegation;
  } else if (firstOperation.type === 'staking') {
    return HistoryItemOpTypeEnum.Staking;
  } else if (firstOperation.type === 'origination') {
    return HistoryItemOpTypeEnum.Origination;
  } else if (firstOperation.type === 'reveal') {
    return HistoryItemOpTypeEnum.Reveal;
  } else {
    if (items.some(item => item?.entrypoint?.toLocaleLowerCase() === 'swap')) {
      return HistoryItemOpTypeEnum.Swap;
    } else {
      // has already type from HistoryItemOpTypeEnum (only firstOperation has original api data)
      const item = items[0];

      if (items.some(item => item.entrypoint === 'placeSellOrder' || item.entrypoint === 'placeBuyOrder')) {
        return HistoryItemOpTypeEnum.Multiple;
      }

      // check if sender address is the source address and if type if transaction
      if (item.source.address === address && item.type === HistoryItemOpTypeEnum.TransferTo && items.length === 1) {
        return HistoryItemOpTypeEnum.TransferTo;
      }

      if (item.entrypoint !== undefined && item.entrypoint !== 'transfer') {
        return HistoryItemOpTypeEnum.Interaction;
      }

      if ('tokenTransfers' in item && item.tokenTransfers && items.length === 1)
        if (item.tokenTransfers?.recipients?.find(o => o.to.address === address)) {
          return HistoryItemOpTypeEnum.TransferFrom;
        } else {
          type = HistoryItemOpTypeEnum.TransferTo;
        }
    }
  }

  return type;
}

function buildTokenTransferItem(
  operation: TzktTransactionOperation,
  tokenType: TokenType,
  address: string
): HistoryItemTokenTransfer | null {
  const params = operation.parameter;
  if (params === null) return null;
  else if (tokenType === 'fa2') {
    const values = reduceParameterFa2Values(params.value, address);
    const firstVal = values[0];
    if (firstVal == null) return null;
    const tokenSlug = toTokenSlug(operation.target.address, Number(firstVal.tokenId));
    return {
      totalAmount: firstVal.totalAmount,
      recipients: firstVal.recipients,
      id: operation.id,
      level: operation.level || 0,
      sender: transformToHistoryMember(firstVal.from),
      tokenContractAddress: operation.target.address,
      tokenId: Number(firstVal.tokenId),
      tokenType: tokenType,
      assetSlug: tokenSlug
    };
  } else if (tokenType === 'fa12') {
    const source = { ...operation.sender };
    const recipient = transformToHistoryMember(params.value.to);
    if (params.value.from === address) source.address = address;
    else if (params.value.to === address) source.address = params.value.from;
    else return null;
    const tokenSlug = toTokenSlug(operation.target.address, 0);
    return {
      totalAmount: params.value.value,
      recipients: [{ to: recipient, amount: params.value.value }],
      id: operation.id,
      level: operation.level || 0,
      sender: source,
      tokenContractAddress: operation.target.address,
      tokenId: 0,
      tokenType: tokenType,
      assetSlug: tokenSlug
    };
  } else {
    const source = operation.sender;
    const amount = String(operation.amount);
    const recipient = transformToHistoryMember(operation.target.address);
    return {
      totalAmount: amount,
      recipients: [{ to: recipient, amount: amount }],
      id: operation.id,
      level: operation.level || 0,
      sender: source,
      tokenContractAddress: 'tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg',
      tokenId: 0,
      tokenType: tokenType,
      assetSlug: MAV_TOKEN_SLUG
    };
  }
}

function transformToHistoryMember(address: string, alias: string = ''): TzktAlias {
  // Transform the data into TzktAlias format
  return { alias: alias, address: address };
}

// set the end destination address based on diffs if it exists
// f.e. JPD 200 -> SIRS -> Mavryk Finance
// we wend to SIRS but the end address is Mavryk Finance so we show that address instead of SIRS address
// NOTE - It doesn't apply to simple transfers where we have amount
function getDestinationAddress(operation: TzktTransactionOperation) {
  return operation.parameter?.entrypoint &&
    operation.parameter.entrypoint === 'transfer' &&
    operation.parameter.value.length === 1 &&
    operation.parameter.value[0].txs.length === 1
    ? { address: operation.parameter.value[0].txs[0].to_ }
    : operation.target;
}

// For custom pending transactions stored in browser storage
export const buildStorageKeyForTx = (pkh: string, chainId: TzktApiChainId) => {
  return `${pkh}_${chainId}_pending_transactions`;
};

type BuildPendingOperationObjecttype = {
  operation?: ((TransactionOperation | WalletOperation) & { opHash?: string; hash?: string }) | null;
  type: string;
  sender: string;
  to?: string;
  amount?: number | string;
  newDelegate?: string | null;
  prevDelegate?: string | null;
  baker?: string | null;
  kind?: string;
  estimation?: Estimate;
  assetSlug?: string;
  feeMumav?: number;
};

const normalizePendingAmount = (amount?: number | string) => {
  if (amount == null) return undefined;

  const amountBN = new BigNumber(amount);
  if (amountBN.isNaN()) return undefined;

  return amountBN.toNumber();
};

const getPendingAssetContext = (assetSlug?: string) => {
  if (!assetSlug || assetSlug === MAV_TOKEN_SLUG) {
    return {
      currency: MVRK_CURRENCY
    };
  }

  const [tokenAddress, tokenIdRaw] = assetSlug.split('_');

  return {
    tokenAddress,
    tokenId: Number(tokenIdRaw ?? '0')
  };
};

const normalizePendingStakingAction = (kind?: string) => {
  switch (kind) {
    case StakingActions.unstake:
      return StakingActions.unstake;

    case StakingActions.restake:
      return StakingActions.restake;

    case 'finalize_unstake':
    case StakingActions.finalize:
      return StakingActions.finalize;

    case StakingActions.slash_staked:
      return StakingActions.slash_staked;

    case StakingActions.slash_unstaked:
      return StakingActions.slash_unstaked;

    case StakingActions.stake:
    default:
      return StakingActions.stake;
  }
};

const buildPendingNetworkFees = (estimation?: Estimate, feeMumav?: number): MavrykHistoryNetworkFees => {
  const gasFeeMumav = feeMumav ?? estimation?.suggestedFeeMumav ?? 0;
  const storageFeeMumav = estimation?.burnFeeMumav ?? 0;

  return {
    totalFee: mumavToTz(gasFeeMumav + storageFeeMumav).toNumber(),
    gasFee: mumavToTz(gasFeeMumav).toNumber(),
    storageFee: mumavToTz(storageFeeMumav).toNumber(),
    burnedFromFees: mumavToTz(storageFeeMumav).toNumber()
  };
};

export async function buildPendingOperationObject({
  operation,
  type,
  sender,
  to,
  amount,
  newDelegate,
  prevDelegate,
  estimation,
  kind,
  baker,
  assetSlug,
  feeMumav
}: BuildPendingOperationObjecttype) {
  if (!operation) return null;

  const hash = operation.opHash || operation.hash;
  if (!hash) return null;

  const now = dayjs().toISOString();
  const normalizedAmount = normalizePendingAmount(amount);
  const networkFees = buildPendingNetworkFees(estimation, feeMumav);

  const baseOperationFields: MavrykHistoryOperation = {
    type,
    id: Date.now(),
    timestamp: now,
    hash,
    sender,
    gasLimit: estimation?.gasLimit ?? 0,
    gasUsed: estimation?.consumedMilligas ? Math.ceil(Number(estimation.consumedMilligas) / 1000) : 0,
    storageLimit: estimation?.storageLimit ?? 0,
    storageUsed: estimation?.storageLimit ?? 0,
    networkFees,
    status: 'pending'
  };

  if (normalizedAmount !== undefined) {
    baseOperationFields.amount = normalizedAmount;
  }

  if (to) {
    baseOperationFields.target = to;
  }

  switch (type) {
    case 'delegation': {
      const delegationTarget = newDelegate ?? to;

      return {
        ...baseOperationFields,
        target: delegationTarget ?? undefined,
        newDelegate: newDelegate ?? null,
        prevDelegate: prevDelegate ?? null,
        details: {
          type: 'delegation',
          from: sender,
          to: delegationTarget ?? undefined,
          newDelegate: newDelegate ?? null,
          prevDelegate: prevDelegate ?? null
        }
      };
    }

    case 'staking': {
      const action = normalizePendingStakingAction(kind);
      const stakingTarget = baker ?? to;

      return {
        ...baseOperationFields,
        target: stakingTarget ?? undefined,
        action,
        baker: baker ?? undefined,
        details: {
          type: 'staking',
          action,
          amount: normalizedAmount,
          from: sender,
          to: stakingTarget ?? undefined,
          baker: baker ?? undefined
        }
      };
    }

    case 'transaction': {
      const { tokenAddress, tokenId, currency } = getPendingAssetContext(assetSlug);

      return {
        ...baseOperationFields,
        details: {
          type: 'transfer',
          transferType: 'sent',
          from: sender,
          to,
          amount: normalizedAmount,
          currency,
          tokenAddress,
          tokenId,
          entrypoint: tokenAddress ? 'transfer' : undefined
        }
      };
    }

    case 'origination':
      return {
        ...baseOperationFields,
        details: {
          type: 'origination',
          from: sender,
          to
        }
      };

    case 'reveal':
      return {
        ...baseOperationFields,
        details: {
          type: 'reveal',
          from: sender
        }
      };

    default:
      return {
        ...baseOperationFields
      };
  }
}

export type CustomPendingOperation = MavrykHistoryOperation;

export const putOperationIntoStorage = async (
  chainId: string | null | undefined,
  accountPkh: string,
  pendingOpObject: CustomPendingOperation
) => {
  try {
    if (chainId && isKnownChainId(chainId)) {
      const storageKey = buildStorageKeyForTx(accountPkh, chainId);
      const operations = (await fetchFromStorage<CustomPendingOperation[]>(storageKey)) ?? [];
      await putToStorage(storageKey, [...operations, pendingOpObject]);
    }
  } catch (e) {
    console.log('Error putting pending operation into browser storage');
  }
};
