import axios from 'axios';
import { chunk } from 'lodash';
import memoizee from 'memoizee';

import { IS_STAGE_ENV } from 'lib/env';
import { TempleChainId } from 'lib/temple/types';

const LOCAL_METADATA_API_URL = process.env.LOCAL_METADATA_API_URL;

if (LOCAL_METADATA_API_URL) console.warn(`process.env.LOCAL_METADATA_API_URL found. Will use it for metadata loading.`);

const API_CHAIN_NAMES = {
  [TempleChainId.Mainnet]: 'mainnet',
  [TempleChainId.Basenet]: 'basenet',
  [TempleChainId.Atlas]: 'atlasnet',
  [TempleChainId.Weekly]: 'weeklynet'
};

type MetadataApiChainId = keyof typeof API_CHAIN_NAMES;

const KNOWN_CHAIN_IDS = Object.keys(API_CHAIN_NAMES);

export const isKnownChainId = (chainId: string): chainId is MetadataApiChainId => KNOWN_CHAIN_IDS.includes(chainId);

export interface TokenMetadataResponse {
  decimals: number;
  symbol?: string;
  name?: string;
  thumbnailUri?: string;
  artifactUri?: string;
  displayUri?: string;
  image?: string;
}

export const fetchOneTokenMetadata = (chainId: MetadataApiChainId, address: string, id: string) =>
  getApi(chainId)
    .get<TokenMetadataResponse>(`/metadata/${address}/${id}`)
    .then(({ data }) => (data.name === 'Unknown Token' ? undefined : data));

export const METADATA_API_LOAD_CHUNK_SIZE = 50;

export const fetchTokensMetadata = (
  chainId: MetadataApiChainId,
  slugs: string[]
): Promise<(TokenMetadataResponse | null)[]> => {
  if (slugs.length === 0) return Promise.resolve([]);

  return Promise.all(
    // Parallelizing
    chunk(slugs, METADATA_API_LOAD_CHUNK_SIZE).map(clugsChunk => fetchTokensMetadataChunk(chainId, clugsChunk))
  ).then(datum => {
    return datum.flat();
  });
};

const fetchTokensMetadataChunk = memoizee(
  // Simply reducing frequency of requests per set of arguments.
  (chainId: MetadataApiChainId, slugs: string[]) =>
    getApi(chainId)
      .post<(TokenMetadataResponse | null)[]>('/', slugs)
      .then(r => r.data),
  {
    maxAge: 10_000,
    normalizer: ([chainId, slugs]) => `${chainId}:${slugs.join()}`,
    promise: true
  }
);

const getApi = memoizee(
  (chainId: MetadataApiChainId) => {
    const baseURL = buildApiUrl(chainId);
    return axios.create({ baseURL });
  },
  { promise: true }
);

const buildApiUrl = (chainId: string) => {
  if (LOCAL_METADATA_API_URL) return LOCAL_METADATA_API_URL;

  const chainName = API_CHAIN_NAMES[chainId as MetadataApiChainId];

  if (!chainName) throw new Error('Unknown Chain ID to Mavryk Metadata service');

  if (IS_STAGE_ENV) return `https://metadata-api-${chainName}-stage.mavryk.network`;

  return `https://metadata-api-${chainName}-prod.mavryk.network`;
};
