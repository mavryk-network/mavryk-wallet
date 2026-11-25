import { MavrykToolkit } from '@mavrykdynamics/webmavryk';
import { pick } from 'lodash';

import {
  TokenMetadataResponse,
  fetchOneTokenMetadata as fetchOneTokenMetadataOnAPI,
  fetchTokensMetadata as fetchTokensMetadataOnAPI,
  isKnownChainId
} from 'lib/apis/temple/metadata';
import { fromAssetSlug } from 'lib/assets/utils';

import { TokenMetadataOnChain, fetchTokenMetadata as fetchTokenMetadataOnChain } from './on-chain';

export const fetchOneTokenMetadata = async (
  rpcUrl: string,
  address: string,
  id: string,
  expectedChainId?: string
): Promise<TokenMetadataResponse | undefined> => {
  const tezos = new MavrykToolkit(rpcUrl);
  const chainId = await tezos.rpc.getChainId();
  if (expectedChainId && chainId !== expectedChainId) throw new Error('Metadata RPC chain changed');

  if (isKnownChainId(chainId)) {
    return await fetchOneTokenMetadataOnAPI(chainId, address, id);
  }

  const metadataOnChain = await fetchTokenMetadataOnChain(tezos, address, id);

  if (!metadataOnChain) throw new Error('Unconfirmed on-chain metadata');
  return chainTokenMetadataToBase(metadataOnChain) || undefined;
};

const fetchTokensMetadata = async (
  rpcUrl: string,
  slugs: string[],
  strict = false,
  expectedChainId?: string
): Promise<(TokenMetadataResponse | null)[]> => {
  if (slugs.length === 0) return [];

  const tezos = new MavrykToolkit(rpcUrl);
  const chainId = await tezos.rpc.getChainId();
  if (expectedChainId && chainId !== expectedChainId) throw new Error('Metadata RPC chain changed');

  if (isKnownChainId(chainId)) {
    return await fetchTokensMetadataOnAPI(chainId, slugs);
  }

  return await Promise.all(
    slugs.map(async slug => {
      const [address, id] = fromAssetSlug(slug);
      if (!id) return null;

      return await fetchTokenMetadataOnChain(tezos, address, id)
        .then(value => {
          if (strict && !value) throw new Error('Unconfirmed on-chain metadata');
          return chainTokenMetadataToBase(value);
        })
        .catch(() => {
          if (strict) throw new Error('Unable to fetch on-chain metadata');

          return null;
        });
    })
  );
};

const chainTokenMetadataToBase = (metadata: TokenMetadataOnChain | nullish): TokenMetadataResponse | null =>
  metadata ? pick(metadata, 'name', 'symbol', 'decimals', 'thumbnailUri', 'displayUri', 'artifactUri') : null;

export const loadTokensMetadata = (rpcUrl: string, slugs: string[]) =>
  fetchTokensMetadata(rpcUrl, slugs).then(data => reduceToMetadataRecord(slugs, data));

export type FetchedMetadataRecord = Record<string, TokenMetadataResponse | null>;

export const reduceToMetadataRecord = (slugs: string[], list: (TokenMetadataResponse | null)[]) =>
  list.reduce<FetchedMetadataRecord>((acc, metadata, index) => {
    const slug = slugs[index]!;

    return { ...acc, [slug]: metadata };
  }, {});

/** Strict foreground requests cannot interpret caught on-chain failures as confirmed misses. */
export const loadTokensMetadataStrict = async (rpcUrl: string, slugs: string[], expectedChainId?: string) => {
  const data = await fetchTokensMetadata(rpcUrl, slugs, true, expectedChainId);
  if (!Array.isArray(data) || data.length !== slugs.length) throw new Error('Incomplete metadata response');
  return reduceToMetadataRecord(slugs, data);
};
