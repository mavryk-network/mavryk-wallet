import { chunk } from 'lodash';
import { forkJoin, map } from 'rxjs';

import { fromAssetSlug } from 'lib/assets/utils';
import { IS_DEV_ENV } from 'lib/env';

import { MvktRWAAssetMetadata } from '../mvkt/types';
import { fetchWithTimeout } from '../mvkt/utils';

import { MAX_RWA_QUERY_RESPONSE_ITEMS } from './consts';
import { MOCK_RWA_CONFIG, MOCKED_RWA_ASSETS } from './mock';
import { RWA_ASSETS_CONTRACTS_QUERY, RWA_TOKEN_METADATA_QUERY } from './queries';
import { dodoAssetsContractsSchema } from './rwa.schema';

export async function fetchRwaAssetsContracts() {
  if (!process.env.EXTERNAL_API) {
    return MOCK_RWA_CONFIG.dodo_mav.map(item => item.base_token.address);
  }

  try {
    const response = await fetchWithTimeout(`${process.env.EXTERNAL_API}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: RWA_ASSETS_CONTRACTS_QUERY
      })
    });

    if (!response.ok) {
      if (IS_DEV_ENV) console.error(`[rwa] GraphQL request failed: ${response.statusText}`);

      return MOCK_RWA_CONFIG.dodo_mav.map(item => item.base_token.address);
    }
    const { data } = await response.json();

    if (!data) return [];

    const parsedAssetsResponse = dodoAssetsContractsSchema.validateSync(data, { abortEarly: false });

    return parsedAssetsResponse.dodo_mav.map(item => item.base_token.address);
  } catch (e) {
    if (IS_DEV_ENV) console.error('[rwa] fetchRwaAssetsContracts error:', e);
    return [];
  }
}

// api rwa metadata utils
export async function fetchRwaAssetsMetadata$(contracts: string[]): Promise<any[]> {
  if (!process.env.EXTERNAL_API) {
    return MOCKED_RWA_ASSETS;
  }

  const variables = {
    addresses: contracts.map(address => fromAssetSlug(address)[0])
  };

  try {
    const response = await fetchWithTimeout(`${process.env.EXTERNAL_API}`, {
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
      if (IS_DEV_ENV) console.error(`[rwa] fetchRwaAssetsMetadata$ failed: ${response.statusText}`);
      return MOCKED_RWA_ASSETS;
    }
    // TODO add zod schema // HERE
    const { data } = await response.json();

    return data.token;
  } catch (e) {
    if (IS_DEV_ENV) console.error('[rwa] fetchRwaAssetsMetadata$ error:', e);
    return MOCKED_RWA_ASSETS;
  }
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
            try {
              assetDetails = JSON.parse(assetDetailsJSON);
            } catch {
              // malformed asset details — fall through with null
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
