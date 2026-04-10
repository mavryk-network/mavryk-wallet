import { chunk } from 'lodash';
import { forkJoin, map } from 'rxjs';

import { fromAssetSlug } from 'lib/assets/utils';

import { MvktRWAAssetMetadata } from '../mvkt/types';
import { fetchWithTimeout } from '../mvkt/utils';

import { MAX_RWA_QUERY_RESPONSE_ITEMS } from './consts';
import { MOCK_RWA_CONFIG, MOCKED_RWA_ASSETS } from './mock';
import { RWA_ASSETS_CONTRACTS_QUERY, RWA_TOKEN_METADATA_QUERY } from './queries';
import { AssetDetailsSchema, dodoAssetsContractsSchema, RwaTokenMetadataSchema } from './rwa.schema';

export async function fetchRwaAssetsContracts() {
  if (!process.env.EXTERNAL_API) {
    return MOCK_RWA_CONFIG.dodo_mav.map(item => item.base_token.address);
  }

  try {
    const response = await fetchWithTimeout(`${process.env.EXTERNAL_API}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: RWA_ASSETS_CONTRACTS_QUERY
      })
    });

    if (!response.ok) {
      console.error(`GraphQL request failed with status ${response.status}`);

      return MOCK_RWA_CONFIG.dodo_mav.map(item => item.base_token.address);
    }
    const { data } = await response.json();
    const parsedAssetsResponse = dodoAssetsContractsSchema.parse(data);

    return parsedAssetsResponse.dodo_mav.map(item => item.base_token.address);
  } catch (e) {
    console.error(e);
    return [];
  }
}

// api rwa metadata utils
type RwaToken = (typeof RwaTokenMetadataSchema)['_output']['token'][number];

export async function fetchRwaAssetsMetadata$(contracts: string[]): Promise<RwaToken[]> {
  if (!process.env.EXTERNAL_API) {
    return MOCKED_RWA_ASSETS;
  }

  const variables = {
    addresses: contracts.map(address => fromAssetSlug(address)[0])
  };

  const response = await fetchWithTimeout(`${process.env.EXTERNAL_API}/graphql`, {
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
    console.error(`GraphQL request failed with status ${response.status}`);
    return MOCKED_RWA_ASSETS;
  }
  const { data } = await response.json();
  const parsed = RwaTokenMetadataSchema.parse(data);

  return parsed.token;
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

          if (assetDetailsJSON && assetDetailsJSON.length < 10_000) {
            try {
              assetDetails = AssetDetailsSchema.parse(JSON.parse(assetDetailsJSON));
            } catch {
              assetDetails = null;
            }
          }

          return {
            decimals,
            thumbnailUri,
            address,
            description: assetDetails?.propertyDetails?.description ?? '',
            name,
            symbol,
            shouldPreferSymbol
          } as MvktRWAAssetMetadata;
        });
      })
    )
  ).pipe(
    map(results => ({ tokens: results.flat() })) // Flatten and wrap in { tokens }
  );
