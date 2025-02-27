import { TzktAccount, TzktRWAAssetMetadata, TzktRWAAssetMetadataResponse } from './types';

export const calcTzktAccountSpendableTezBalance = ({ balance, stakedBalance, unstakedBalance }: TzktAccount) =>
  ((balance ?? 0) - (stakedBalance ?? 0) - (unstakedBalance ?? 0)).toFixed();

type ParameterFa12 = {
  entrypoint: string;
  value: {
    to: string;
    from: string;
    value: string;
  };
};

interface Fa2Transaction {
  to_: string;
  amount: string;
  token_id: string;
}

interface Fa2OpParams {
  txs: Fa2Transaction[];
  from_: string;
}

export type ParameterFa2 = {
  entrypoint: string;
  value: Fa2OpParams[];
};
type ParameterLiquidityBaking = {
  entrypoint: string;
  value: {
    target: string;
    quantity: string; // can be 'number' or '-number
  };
};

export function isTzktOperParam(param: any): param is {
  entrypoint: string;
  value: any;
} {
  if (param == null) return false;
  if (typeof param.entrypoint !== 'string') return false;
  return 'value' in param;
}

export function isTzktOperParam_Fa12(param: any): param is ParameterFa12 {
  if (!isTzktOperParam(param)) return false;
  if (param.value == null) return false;
  if (typeof param.value.to !== 'string') return false;
  if (typeof param.value.from !== 'string') return false;
  if (typeof param.value.value !== 'string') return false;

  return true;
}

/**
 * (!) Might only refer to `param.entrypoint === 'transfer'` case
 * (?) So, would this check be enough?
 */
export function isTzktOperParam_Fa2(param: any): param is ParameterFa2 {
  if (!isTzktOperParam(param)) return false;
  if (!Array.isArray(param.value)) return false;
  let item = param.value[0];
  if (item == null) return true;
  if (typeof item.from_ !== 'string') return false;
  if (!Array.isArray(item.txs)) return false;
  item = item.txs[0];
  if (item == null) return true;
  if (typeof item.to_ !== 'string') return false;
  if (typeof item.amount !== 'string') return false;
  if (typeof item.token_id !== 'string') return false;

  return true;
}

export function isTzktOperParam_LiquidityBaking(param: any): param is ParameterLiquidityBaking {
  if (!isTzktOperParam(param)) return false;
  if (param.value == null) return false;
  if (typeof param.value.target !== 'string') return false;
  if (typeof param.value.quantity !== 'string') return false;

  return true;
}

export async function fetchWithTimeout(url: string, params: RequestInit = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal, ...params });

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// api rwa metadata utils
export async function fetchRwaAssetsMetadata(contracts: string[]) {
  const query = `
    query MarketTokens($addresses: [String!]!) {
      token(where: { address: { _in: $addresses } }) {
        address
        token_id
        token_standard
        token_metadata
        metadata
      }
    }
  `;

  const variables = {
    addresses: contracts
  };

  const response = await fetchWithTimeout('https://api.equiteez.com/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }
  // TODO add zod schema // HERE
  const { data } = await response.json();

  return data.token;
}

// TODO add zod schema // HERE
export const parseRwaMetadatas = (metas: TzktRWAAssetMetadataResponse[]) => {
  return metas.reduce<StringRecord<TzktRWAAssetMetadata>>((acc, meta) => {
    const { token_metadata, address } = meta;
    const { assetDetails: assetDetailsJSON, decimals, thumbnailUri, name, shouldPreferSymbol, symbol } = token_metadata;
    let assetDetails = null;

    if (assetDetailsJSON) {
      assetDetails = JSON.parse(assetDetailsJSON);
    }

    acc[meta.address] = {
      decimals,
      thumbnailUri,
      address,
      description: assetDetails?.propertyDetails?.description ?? '',
      name,
      symbol,
      shouldPreferSymbol
    };
    return acc;
  }, {});
};
