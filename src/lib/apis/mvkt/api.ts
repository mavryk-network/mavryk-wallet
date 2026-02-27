import { HubConnectionBuilder } from '@microsoft/signalr';
import retry from 'async-retry';
import axios, { AxiosError } from 'axios';

import { toTokenSlug } from 'lib/assets';
import { KYC_CONTRACTS } from 'lib/route3/constants';
import { TempleChainId } from 'lib/temple/types';
import { delay } from 'lib/utils';

import { fetchRwaAssetsContracts } from '../rwa';

import {
  MvktOperation,
  MvktOperationType,
  MvktQuoteCurrency,
  MvktAccountAsset,
  allInt32ParameterKeys,
  MvktGetRewardsParams,
  MvktGetRewardsResponse,
  MvktRelatedContract,
  MvktAccount,
  MvktHubConnection,
  SetDelegateParametersOperation
} from './types';
import { calcMvktAccountSpendableTezBalance } from './utils';

export const MVKT_API_BASE_URLS = {
  [TempleChainId.Mainnet]: 'https://api.mavryk.network/v1',
  [TempleChainId.Atlas]: 'https://atlasnet.api.mavryk.network/v1',
  [TempleChainId.Basenet]: 'https://api.mavryk.network/basenet/v1',
  [TempleChainId.Weekly]: 'https://api.mavryk.network/weeklynet/v1'
};

export type MvktApiChainId = keyof typeof MVKT_API_BASE_URLS;

const KNOWN_CHAIN_IDS = Object.keys(MVKT_API_BASE_URLS);

export function isKnownChainId(chainId?: string | null): chainId is MvktApiChainId {
  return chainId != null && KNOWN_CHAIN_IDS.includes(chainId);
}

export const createWsConnection = (chainId: string): MvktHubConnection | undefined => {
  if (isKnownChainId(chainId)) {
    return new HubConnectionBuilder().withUrl(`${MVKT_API_BASE_URLS[chainId]}/ws`).build();
  }

  return undefined;
};

const api = axios.create();

api.interceptors.response.use(
  res => res,
  err => {
    const message = (err as AxiosError<{ message?: string }>).response?.data?.message;
    console.error(`Failed when querying MvKT API: ${message}`, err);
    throw err;
  }
);

async function fetchGet<R>(chainId: MvktApiChainId, endpoint: string, params?: Record<string, unknown>) {
  const { data } = await api.get<R>(endpoint, {
    baseURL: MVKT_API_BASE_URLS[chainId],
    params
  });

  return data;
}

type GetOperationsBaseParams = {
  limit?: number;
  offset?: number;
  entrypoint?: string;
  lastId?: number;
} & {
  [key in `timestamp.${'lt' | 'ge'}`]?: string;
} & {
  [key in `level.${'lt' | 'ge'}`]?: number;
} & {
  [key in `target${'' | '.ne'}`]?: string;
} & {
  [key in `sender${'' | '.ne'}`]?: string;
} & {
  [key in `initiator${'' | '.ne'}`]?: string;
};

export const fetchGetAccountOperationByHash = async (
  chainId: MvktApiChainId,
  _accountAddress: string,
  hash: string | undefined
) => {
  try {
    if (!hash) {
      throw new Error('No transaction hash is provided!');
    }
    // fetching operation from /operations, cuz parameter filter doesnt work on account operations
    // example -> /accounts/{address}/operation?parameter.hash={hash} -> wont work
    // const [operation] = await fetchGetOperationsByHash(chainId, hash);
    return fetchGet<MvktOperation[]>(chainId, `/operations/${hash}`, {
      // level: operation.level
    });
  } catch (e) {
    throw new Error("Can't fetch transaction by hash");
  }
};

export const fetchGetAccountOperations = (
  chainId: MvktApiChainId,
  accountAddress: string,
  params: GetOperationsBaseParams & {
    type?: MvktOperationType | MvktOperationType[];
    sort?: 0 | 1;
    quote?: MvktQuoteCurrency[];
    'parameter.null'?: boolean;
  }
) =>
  fetchGet<MvktOperation[]>(chainId, `/accounts/${accountAddress}/operations`, {
    ...params,
    type: Array.isArray(params.type) ? params.type.join(',') : params.type
  });

export const fetchGetOperationsByHash = (
  chainId: MvktApiChainId,
  hash: string,
  params: {
    quote?: MvktQuoteCurrency[];
  } = {}
) => fetchGet<MvktOperation[]>(chainId, `/operations/${hash}`, params);

export type GetOperationsTransactionsParams = GetOperationsBaseParams & {
  [key in `anyof.sender.target${'' | '.initiator'}`]?: string;
} & {
  [key in `amount${'' | '.ne'}`]?: string;
} & {
  [key in `parameter.${'to' | 'in' | '[*].in' | '[*].txs.[*].to_'}`]?: string;
} & {
  [key in `sort${'' | '.desc'}`]?: 'id' | 'level';
} & { type?: MvktOperationType };

export type ExtendedGetOperationsTransactionsParams = Omit<GetOperationsTransactionsParams, 'entrypoint'> & {
  type?: MvktOperationType;
  hasInternals?: boolean;
  entrypoint?: string;
  'entrypoint.null'?: boolean;
  'entrypoint.ne'?: string;
  'parameter.originatedContract.null'?: boolean;
  'sender.eq'?: string;
  'target.eq'?: string;
};

export const fetchGetOperationsTransactions = (chainId: MvktApiChainId, params: GetOperationsTransactionsParams) =>
  fetchGet<MvktOperation[]>(chainId, `/operations/transactions`, params);

export const getOneUserContracts = (chainId: MvktApiChainId, accountAddress: string) =>
  fetchGet<MvktRelatedContract[]>(chainId, `/accounts/${accountAddress}/contracts`);

export const getDelegatorRewards = (
  chainId: MvktApiChainId,
  { address, cycle = {}, sort, quote, ...restParams }: MvktGetRewardsParams
) =>
  fetchGet<MvktGetRewardsResponse>(chainId, `/rewards/delegators/${address}`, {
    ...allInt32ParameterKeys.reduce(
      (cycleParams, key) => ({
        ...cycleParams,
        [`cycle.${key}`]: cycle[key]
      }),
      {}
    ),
    ...(sort ? { [`sort.${sort}`]: 'cycle' } : {}),
    quote: quote?.join(','),
    ...restParams
  });

const MVKT_MAX_QUERY_ITEMS_LIMIT = 10_000;

/**
 * @arg fungible // `null` for unknown fungibility only
 */
export function fetchMvktAccountAssets(account: string, chainId: string, fungible: boolean | null) {
  if (!isKnownChainId(chainId)) return Promise.resolve([]);

  const recurse = async (accum: MvktAccountAsset[], offset: number): Promise<MvktAccountAsset[]> => {
    const data = await fetchMvktAccountAssetsPage(account, chainId, offset, fungible);
    if (!data.length) return accum;

    if (data.length === MVKT_MAX_QUERY_ITEMS_LIMIT)
      return recurse(accum.concat(data), offset + MVKT_MAX_QUERY_ITEMS_LIMIT);

    return accum.concat(data);
  };

  return recurse([], 0);
}

export async function fetchMvktAccountRWAAssets(account: string, chainId: string, fungible: boolean | null) {
  if (!isKnownChainId(chainId)) return Promise.resolve([]);

  const recurse = async (accum: MvktAccountAsset[], offset: number): Promise<MvktAccountAsset[]> => {
    const data = await fetchMvktAccountRWAAssetsPage(account, chainId, offset, fungible);
    if (!data.length) return accum;

    if (data.length === MVKT_MAX_QUERY_ITEMS_LIMIT)
      return recurse(accum.concat(data), offset + MVKT_MAX_QUERY_ITEMS_LIMIT);

    return accum.concat(data);
  };
  return recurse([], 0);
}

const fetchMvktAccountAssetsPage = (
  account: string,
  chainId: MvktApiChainId,
  offset?: number,
  fungible: boolean | null = null
) =>
  fetchGet<MvktAccountAsset[]>(chainId, '/tokens/balances', {
    account,
    limit: MVKT_MAX_QUERY_ITEMS_LIMIT,
    offset,
    'balance.gt': 0,
    ...(fungible === null
      ? { 'token.metadata.null': true }
      : {
          'token.metadata.artifactUri.null': fungible
        }),
    'sort.desc': 'balance'
  });

async function fetchMvktAccountRWAAssetsPage(
  account: string,
  chainId: MvktApiChainId,
  offset?: number,
  fungible: boolean | null = null
) {
  try {
    return await retry(
      async bail => {
        try {
          const rwaContracts = await fetchRwaAssetsContracts();
          const data = await fetchGet<MvktAccountAsset[]>(chainId, '/tokens/balances', {
            account,
            limit: MVKT_MAX_QUERY_ITEMS_LIMIT,
            offset,
            ...(fungible === null
              ? { 'token.metadata.null': true }
              : {
                  'token.contract.in': rwaContracts.join(',')
                }),
            'sort.desc': 'balance'
          });

          const mappedResult = data.map(item => {
            return {
              ...item,
              token: { ...item.token }
            };
          });

          return mappedResult;
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new Error('Request timeout');
          }

          if (error.message.includes('403')) {
            bail(new Error('Unauthorized'));
          }

          throw error;
        }
      },
      {
        retries: 5,
        factor: 2, // Exponential backoff
        minTimeout: 1000, // 1s initial delay
        maxTimeout: 10000 // 10s max delay
      }
    );
  } catch (error) {
    console.error('API failed after 5 retries:', error);
    return [];
  }
}

export async function refetchOnce429<R>(fetcher: () => Promise<R>, delayAroundInMS = 1000) {
  try {
    return await fetcher();
  } catch (err: any) {
    if (err.isAxiosError) {
      const error: AxiosError = err;
      if (error.response?.status === 429) {
        await delay(delayAroundInMS);
        const res = await fetcher();
        await delay(delayAroundInMS);
        return res;
      }
    }

    throw err;
  }
}

export const fetchTezosBalanceFromMvkt = async (account: string, chainId: MvktApiChainId) =>
  getAccountStatsFromMvkt(account, chainId).then(calcMvktAccountSpendableTezBalance);

export const fetchAllAssetsBalancesFromMvkt = async (account: string, chainId: MvktApiChainId) => {
  const balances: StringRecord = {};

  await (async function recourse(offset: number) {
    const data = await fetchAssetsBalancesFromMvktOnce(account, chainId, offset);

    for (const [address, tokenId, balance] of data) {
      const slug = toTokenSlug(address, tokenId);
      balances[slug] = balance;
    }

    if (data.length === MVKT_MAX_QUERY_ITEMS_LIMIT) {
      await recourse(offset + MVKT_MAX_QUERY_ITEMS_LIMIT);
    }
  })(0);

  return balances;
};

type AssetBalance = [address: string, tokenId: string, balance: string];

const fetchAssetsBalancesFromMvktOnce = (account: string, chainId: MvktApiChainId, offset = 0) =>
  fetchGet<AssetBalance[]>(chainId, '/tokens/balances', {
    account,
    limit: MVKT_MAX_QUERY_ITEMS_LIMIT,
    offset,
    'select.values': 'token.contract.address,token.tokenId,balance'
  });

export const getAccountStatsFromMvkt = async (account: string, chainId: MvktApiChainId) =>
  fetchGet<MvktAccount>(chainId, `/accounts/${account}`);

export const getKYCStatus = async (pkh: string, chainId: MvktApiChainId | string | null | undefined) => {
  try {
    if (chainId && isKnownChainId(chainId)) {
      const kycAdress = KYC_CONTRACTS.get(chainId);

      if (!kycAdress) return false;
      const storageRes = await fetchGet<any>(chainId, `/contracts/${kycAdress}/storage/`);
      const bigMapId = storageRes.memberLedger;

      const contractData = await fetchGet<any>(chainId, `/bigmaps/${bigMapId}/keys/${pkh}`);

      // if no data than no KYCed user
      if (!contractData) return false;

      const isKYCAddress = contractData;

      return Boolean(isKYCAddress);
    }

    return false;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const fetchBakerDelegateParameters = async (
  bakerAddress: string,
  chainId: MvktApiChainId | string | null | undefined
) => {
  try {
    if (chainId && isKnownChainId(chainId)) {
      const storageRes = await fetchGet<SetDelegateParametersOperation[]>(
        chainId,
        `/operations/set_delegate_parameters`,
        { sender: bakerAddress }
      );

      return storageRes[0] ?? null;
    }

    return null;
  } catch (e) {
    console.error(e);
    return null;
  }
};
