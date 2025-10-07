import { ExtendedGetOperationsTransactionsParams, GetOperationsTransactionsParams } from 'lib/apis/tzkt/api';

import { HistoryItemOpTypeEnum } from './types';

export const createOpParams = (accountAddress: string): StringRecord<ExtendedGetOperationsTransactionsParams> => ({
  [HistoryItemOpTypeEnum.Delegation.toString()]: {
    type: 'delegation'
  },
  [HistoryItemOpTypeEnum.Origination.toString()]: {
    type: 'origination'
  },
  [HistoryItemOpTypeEnum.Staking.toString()]: {
    type: 'staking'
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
 * TODO update current function when API can filter by complex types at the same time
 * (f.e. interaction & sent to ...)
 * Used to merge ONLY specific params of GetOperationsTransactionsParams
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

  // Merge all other parameters except `type`
  const keys = new Set([...Object.keys(prevParams), ...Object.keys(params)]);
  keys.delete('type');

  keys.forEach(key => {
    const prevValue = prevParams[key];
    const newValue = params[key];

    if (prevValue === undefined) {
      mergedParams[key] = newValue;
    } else if (newValue === undefined) {
      mergedParams[key] = prevValue;
    } else if (prevValue === newValue) {
      mergedParams[key] = prevValue;
    } else if (key === 'entrypoint.null') {
      // Apply the specific rules for entrypoint.null
      if ((prevValue === true && newValue === false) || (prevValue === false && newValue === true)) {
        delete mergedParams['entrypoint.null']; // Remove if both true and false exist
      }
    }
  });

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

// TODO: update and test when fa12 token will be available
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
  const query = createQuery(accountAddress, Number(tokenId), undefined);
  const defaultFa_2OpParams: GetOperationsTransactionsParams = {
    entrypoint: 'transfer',
    target: contractAddress,
    ...query,
    'sort.desc': 'level'
  };

  return getReturnedTransactionParams(accountAddress, defaultFa_2OpParams, operationParams);
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

  // target (receiver from )
  // sender (sent to)
  // interaction ...

  let internalOperationParams = { ...operationParams };
  const hasTarget = Boolean(internalOperationParams.target);
  const hasSender = Boolean(internalOperationParams.sender);
  console.log(internalOperationParams, 'internalOperationParams');

  // params for received transactions
  if (internalOperationParams['target'] === accountAddress) {
    delete defaultFa_1_2OpParams['parameter.[*].in'];
    internalOperationParams = {
      ...internalOperationParams,
      ...createQuery(accountAddress, 0, true)
    };
  }

  // params for sent transactions
  if (internalOperationParams['sender'] === accountAddress) {
    delete defaultFa_1_2OpParams['parameter.[*].in'];
    internalOperationParams = {
      ...internalOperationParams,
      ...createQuery(accountAddress, 0, false)
    };
  }

  // used for interactions type
  // remove entrypoint null and hasInternals cuz it's transactions to specific contract address (usually token address)
  if (internalOperationParams.hasOwnProperty('entrypoint.null')) {
    delete internalOperationParams['entrypoint.null'];
  }

  delete internalOperationParams.type;
  delete internalOperationParams.hasInternals;

  // clear target and sender for transaction API filters, because it uses contract address
  // transaction endpoint has different logic for filters so we get rid of them
  if (hasTarget) {
    delete internalOperationParams.target;
  }
  if (hasSender) {
    delete internalOperationParams.sender;
  }

  return mergeOpParams(defaultFa_1_2OpParams, internalOperationParams);
};

const createQuery = (accountAddress: string, tokenId: number, isFrom: boolean | undefined) => {
  if (isFrom === undefined) {
    return {
      'parameter.[*].in': `[{"from_":"${accountAddress}","txs":[{"token_id":"${tokenId}"}]},{"txs":[{"to_":"${accountAddress}","token_id":"${tokenId}"}]}]`
    };
  }

  const filter = !isFrom
    ? `[{"from_":"${accountAddress}","txs":[{"token_id":"${tokenId}"}]}, {"from_":"${accountAddress}","txs":[{"token_id":"${tokenId}"}]}]` // From query
    : `[{"txs":[{"to_":"${accountAddress}","token_id":"${tokenId}"}]},{"txs":[{"to_":"${accountAddress}","token_id":"${tokenId}"}]}]`; // To query

  return {
    'parameter.[*].in': filter
  };
};
