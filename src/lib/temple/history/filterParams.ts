import { ExtendedGetOperationsTransactionsParams, GetOperationsTransactionsParams } from 'lib/apis/tzkt/api';

import { HistoryItemOpTypeEnum } from './types';

export const createOpParams = (accountAddress: string): StringRecord<ExtendedGetOperationsTransactionsParams> => ({
  [HistoryItemOpTypeEnum.Delegation.toString()]: {
    type: 'delegation'
  },
  [HistoryItemOpTypeEnum.Origination.toString()]: {
    type: 'origination'
  },
  [HistoryItemOpTypeEnum.Interaction.toString()]: {
    type: 'transaction',
    'entrypoint.ne': 'transfer',
    'entrypoint.null': false,
    hasInternals: true
  },
  [HistoryItemOpTypeEnum.Reveal.toString()]: {
    type: 'reveal'
  },
  [HistoryItemOpTypeEnum.Swap.toString()]: {
    type: 'transaction',
    entrypoint: 'swap'
  },
  [HistoryItemOpTypeEnum.TransferTo.toString()]: {
    type: 'transaction',
    sender: accountAddress,
    hasInternals: false,
    'entrypoint.null': true
  },
  [HistoryItemOpTypeEnum.TransferFrom.toString()]: {
    type: 'transaction',
    target: accountAddress,
    hasInternals: false
  },
  [HistoryItemOpTypeEnum.Other.toString()]: {
    type: 'other'
  }
});

/**
 * Used to merge ONLY specofic params of GetOperationsTransactionsParams
 * @param prevParams createOpParams returned params  object
 * @param params createOpParams returned params  object
 * @returns merged params object
 */
export const mergeOpParams = (
  prevParams: ExtendedGetOperationsTransactionsParams,
  params: ExtendedGetOperationsTransactionsParams
): ExtendedGetOperationsTransactionsParams => {
  const mergedParams: ExtendedGetOperationsTransactionsParams = { ...prevParams, ...params };

  // Merge `type` values (OR condition)
  if (prevParams.type && params.type) {
    mergedParams.type = Array.from(new Set([...prevParams.type.split(','), ...params.type.split(',')])).join(
      ','
    ) as ExtendedGetOperationsTransactionsParams['type'];
  }

  // Merge `entrypoint` and `entrypoint.null`
  const prevEntrypoint = prevParams.entrypoint;
  const prevEntrypointNull = prevParams['entrypoint.null'];
  const paramsEntrypoint = params.entrypoint;
  const paramsEntrypointNull = params['entrypoint.null'];

  if (prevEntrypoint || paramsEntrypoint) {
    const entrypoints = [prevEntrypoint, paramsEntrypoint].filter(Boolean);
    mergedParams.entrypoint = entrypoints.length > 1 ? entrypoints.join(' OR ') : entrypoints[0];
  }

  if (prevEntrypointNull !== undefined || paramsEntrypointNull !== undefined) {
    mergedParams['entrypoint.null'] =
      prevEntrypointNull !== undefined && paramsEntrypointNull !== undefined
        ? prevEntrypointNull || paramsEntrypointNull // OR condition for boolean
        : prevEntrypointNull !== undefined
        ? prevEntrypointNull
        : paramsEntrypointNull;
  }

  // Merge `hasInternals` using logical OR
  if (prevParams.hasInternals !== undefined || params.hasInternals !== undefined) {
    mergedParams.hasInternals = prevParams.hasInternals || params.hasInternals;
  }

  return mergedParams;
};

export const buildTEZOpParams = (
  accountAddress: string,
  operationParams: GetOperationsTransactionsParams | undefined
): GetOperationsTransactionsParams => {
  const defaultTEZpParams: GetOperationsTransactionsParams = {
    'anyof.sender.target.initiator': accountAddress,
    'sort.desc': 'id',
    'amount.ne': '0'
  };

  if (!operationParams || !Object.keys(operationParams).length) {
    return defaultTEZpParams;
  }

  const internalOperationParams = { ...operationParams };

  const hasBothTargetAndSender = Boolean(internalOperationParams.target) && Boolean(internalOperationParams.sender);

  delete internalOperationParams.type;
  delete internalOperationParams.hasInternals;
  delete defaultTEZpParams['anyof.sender.target.initiator'];

  // filter target to get "received" transactions
  if (hasBothTargetAndSender) {
    internalOperationParams['anyof.sender.target'] = accountAddress;
    delete internalOperationParams.sender;
    delete internalOperationParams.target;
    internalOperationParams['initiator.ne'] = accountAddress;
  } else if (internalOperationParams.target) {
    internalOperationParams['initiator.ne'] = accountAddress;
  }

  return mergeOpParams(defaultTEZpParams, internalOperationParams);
};

export const build_Token_Fa_1_2OpParams = (
  accountAddress: string,
  contractAddress: string,
  operationParams: GetOperationsTransactionsParams | undefined
): GetOperationsTransactionsParams => {
  const defaultFa_1_2OpParams: GetOperationsTransactionsParams = {
    entrypoint: 'transfer',
    target: contractAddress,
    'parameter.in': `[{"from":"${accountAddress}"},{"to":"${accountAddress}"}]`,
    'sort.desc': 'level'
  };

  return getReturnedTransactionParams(accountAddress, defaultFa_1_2OpParams, operationParams);
};

export const build_Token_Fa_2OpParams = (
  accountAddress: string,
  contractAddress: string,
  tokenId: string | number,
  operationParams: GetOperationsTransactionsParams | undefined
): GetOperationsTransactionsParams => {
  const defaultFa_1_2OpParams: GetOperationsTransactionsParams = {
    entrypoint: 'transfer',
    target: contractAddress,
    'parameter.[*].in': `[{"from_":"${accountAddress}","txs":[{"token_id":"${tokenId}"}]},{"txs":[{"to_":"${accountAddress}","token_id":"${tokenId}"}]}]`,
    'sort.desc': 'level'
  };

  return getReturnedTransactionParams(accountAddress, defaultFa_1_2OpParams, operationParams);
};

// helper function to return params for transactions
const getReturnedTransactionParams = (
  accountAddress: string,
  defaultFa_1_2OpParams: GetOperationsTransactionsParams,
  operationParams: GetOperationsTransactionsParams | undefined
) => {
  if (!operationParams || !Object.keys(operationParams).length) {
    return defaultFa_1_2OpParams;
  }

  const internalOperationParams = { ...operationParams };

  const hasBothTargetAndSender = Boolean(internalOperationParams.target) && Boolean(internalOperationParams.sender);

  // used for interactions type
  // remove entrypoint null and hasInternals cuz it's transactions to specific contract address (usually token address)
  if (internalOperationParams.hasOwnProperty('entrypoint.null')) {
    delete internalOperationParams['entrypoint.null'];
    delete internalOperationParams['entrypoint.ne'];

    if (internalOperationParams.sender !== accountAddress) {
      internalOperationParams.initiator = accountAddress;
    }
  }

  // this params will for to /transactions
  // transaction request doesnt have type prop
  delete internalOperationParams.type;
  delete internalOperationParams.hasInternals;
  // filter target to get "received" transactions
  if (hasBothTargetAndSender) {
    internalOperationParams['anyof.sender.target'] = accountAddress;
    delete internalOperationParams.sender;
    delete internalOperationParams.target;
  } else if (internalOperationParams.target !== accountAddress) delete internalOperationParams.target;

  return mergeOpParams(defaultFa_1_2OpParams, internalOperationParams);
};
