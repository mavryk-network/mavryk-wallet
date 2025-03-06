// TODO move to rwa details

import { chunk } from 'lodash';
import { forkJoin, map } from 'rxjs';

import { fromAssetSlug } from 'lib/assets/utils';

import { TzktRWAAssetMetadata } from '../tzkt/types';
import { fetchWithTimeout } from '../tzkt/utils';

import { MAX_RWA_QUERY_RESPONSE_ITEMS } from './consts';
import { RWA_ASSETS_CONTRACTS_QUERY, RWA_TOKEN_METADATA_QUERY } from './queries';
import { dodoAssetsContractsSchema } from './rwa.schema';

export async function fetchRwaAssetsContracts() {
  try {
    const response = await fetchWithTimeout('https://api.equiteez.com/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: RWA_ASSETS_CONTRACTS_QUERY
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }
    const { data } = await response.json();
    const parsedAssetsResponse = dodoAssetsContractsSchema.validateSync(data, { abortEarly: false });

    return parsedAssetsResponse.dodo_mav.reduce<string[]>((acc, item) => {
      acc.push(item.base_token.address);
      return acc;
    }, []);
  } catch (e) {
    console.log(e);
    return [];
  }
}

// api rwa metadata utils
export async function fetchRwaAssetsMetadata$(contracts: string[]): Promise<any[]> {
  const variables = {
    addresses: contracts.map(address => fromAssetSlug(address)[0])
  };

  const response = await fetchWithTimeout('https://api.equiteez.com/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: RWA_TOKEN_METADATA_QUERY,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }
  // TODO add zod schema // HERE
  const { data } = await response.json();

  console.log(data, 'data');

  return data.token;
}

export const fetchRWADetails$ = (slugs: string[]) =>
  forkJoin(
    chunk(slugs, MAX_RWA_QUERY_RESPONSE_ITEMS).map(slugsChunk =>
      fetchRwaAssetsMetadata$(slugsChunk).then(data => {
        return data.map(meta => {
          const { token_metadata, address } = meta;
          const {
            assetDetails: assetDetailsJSON,
            decimals,
            thumbnailUri,
            name,
            shouldPreferSymbol,
            symbol
          } = token_metadata;
          let assetDetails = null;

          if (assetDetailsJSON) {
            assetDetails = JSON.parse(assetDetailsJSON);
          }

          return {
            decimals,
            thumbnailUri,
            address,
            description: assetDetails?.propertyDetails?.description ?? '',
            name,
            symbol,
            shouldPreferSymbol
          } as TzktRWAAssetMetadata;
        });
      })
    )
  ).pipe(
    map(results => ({ tokens: results.flat() })) // Flatten and wrap in { tokens }
  );
