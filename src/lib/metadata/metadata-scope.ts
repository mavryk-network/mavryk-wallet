import { DetailScope } from 'lib/asset-details/details.types';

export interface MetadataScope extends DetailScope {
  rpcUrl: string;
}
export type MetadataCategory = 'tokens' | 'collectibles' | 'rwas';
export type MetadataMode = 'put' | 'whitelist' | 'refresh';

/** Legacy slug records have unknown provenance; new records never cross this source boundary. */
export const getMetadataScopeKey = (scope: MetadataScope) =>
  JSON.stringify([scope.account, scope.chainId, scope.networkId, scope.rpcUrl]);

export const WHITELIST_METADATA_SCOPE_KEY = 'whitelist-madfish-mainnet';
