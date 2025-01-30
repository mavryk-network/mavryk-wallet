import { ExtendedGetOperationsTransactionsParams, GetOperationsTransactionsParams } from 'lib/apis/tzkt/api';

import { HistoryItemOpTypeEnum } from './types';

export const createOpParams = (accountAddress: string): StringRecord<ExtendedGetOperationsTransactionsParams> => ({
  [HistoryItemOpTypeEnum.Delegation.toString()]: {
    type: 'delegation'
  },
  [HistoryItemOpTypeEnum.Origination.toString()]: {
    type: 'origination',
    hasInternals: false,
    'parameter.originatedContract.null': false
  },
  [HistoryItemOpTypeEnum.Interaction.toString()]: {
    type: 'transaction',
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
  const hasAnyofSenderTargetInitiator = Object.keys(operationParams ?? {}).some(
    key => key.startsWith('sender') || key.startsWith('target') || key.startsWith('initiator')
  );

  return {
    ...(hasAnyofSenderTargetInitiator ? operationParams : { 'anyof.sender.target.initiator': accountAddress }),
    ...operationParams,
    'sort.desc': 'id',
    'amount.ne': '0'
  };
};

export const build_Token_Fa_1_2OpParams = (
  accountAddress: string,
  contractAddress: string,
  operationParams: GetOperationsTransactionsParams | undefined
): GetOperationsTransactionsParams => {
  const parameterIn = [];

  const defaultFa_1_2OpParams: GetOperationsTransactionsParams = {
    entrypoint: 'transfer',
    target: contractAddress,
    'parameter.in': `[{"from":"${accountAddress}"},{"to":"${accountAddress}"}]`,
    'sort.desc': 'level'
  };

  if (!operationParams || !Object.keys(operationParams).length) {
    return defaultFa_1_2OpParams;
  }

  const internalOperationParams = { ...operationParams };

  if (internalOperationParams['sender']) {
    parameterIn.push({ from: internalOperationParams['sender'] });
    delete internalOperationParams.sender;
  }

  if (internalOperationParams['target']) {
    parameterIn.push({ to: internalOperationParams['target'] });
    delete internalOperationParams.target;
  }

  if (parameterIn.length > 0) {
    defaultFa_1_2OpParams['parameter.in'] = JSON.stringify(parameterIn);
  }

  return mergeOpParams(defaultFa_1_2OpParams, internalOperationParams);
};

export const build_Token_Fa_2OpParams = (
  accountAddress: string,
  contractAddress: string,
  tokenId: string | number,
  operationParams: GetOperationsTransactionsParams | undefined
): GetOperationsTransactionsParams => {
  const parameterIn = [];

  const defaultFa_1_2OpParams: GetOperationsTransactionsParams = {
    entrypoint: 'transfer',
    target: contractAddress,
    'parameter.[*].in': `[{"from_":"${accountAddress}","txs":[{"token_id":"${tokenId}"}]},{"txs":[{"to_":"${accountAddress}","token_id":"${tokenId}"}]}]`,
    'sort.desc': 'level'
  };

  if (!operationParams || !Object.keys(operationParams).length) {
    return defaultFa_1_2OpParams;
  }

  const internalOperationParams = { ...operationParams };
  const hasBothTargets = internalOperationParams['sender'] && internalOperationParams['target'];

  if (!hasBothTargets) {
    if (internalOperationParams['sender']) {
      parameterIn.push({ from_: accountAddress, txs: [{ token_id: tokenId }] });
      parameterIn.push({ txs: [{ token_id: tokenId }] });
      delete internalOperationParams.sender;
    }

    if (internalOperationParams['target']) {
      parameterIn.push({ txs: [{ token_id: tokenId }] });
      parameterIn.push({ txs: [{ to_: accountAddress, token_id: tokenId }] });
      delete internalOperationParams.target;
    }

    if (parameterIn.length > 0 && !hasBothTargets) {
      defaultFa_1_2OpParams['parameter.[*].in'] = JSON.stringify(parameterIn);
    }
  }

  return mergeOpParams(defaultFa_1_2OpParams, internalOperationParams);
};
