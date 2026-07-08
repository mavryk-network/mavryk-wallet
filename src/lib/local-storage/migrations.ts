import { isNotEmptyString } from '@rnw-community/shared';

import { LEGACY_ATLASNET_CHAIN_ID, LEGACY_ATLASNET_RPC_URL } from 'lib/temple/network-storage';

import { migrate } from './migrator';

migrate([
  {
    name: '1.17.4',
    up: () => {
      const match = (key: string) =>
        /** `no_metadata_${slug}` */
        key.startsWith('no_metadata_') ||
        /** `${Rpc URL}_${Contract address}` // Deprecated cache from class FastRpcClient */
        key.match(/https?:\/\/.*_KT[-a-zA-Z0-9]*$/);

      const keys = new Array(localStorage.length).fill(null).map((_, i) => localStorage.key(i));
      for (const key of keys) {
        if (isNotEmptyString(key) && match(key)) localStorage.removeItem(key);
      }
    }
  },
  {
    name: '1.19.1',
    up: () => localStorage.removeItem('useledgerlive')
  },
  {
    name: 'basenet-rename@2026-06-11',
    up: () => {
      const cachedChainIds = readLocalStorageRecord('FastRpcClient.cachedChainIDs');
      if (cachedChainIds) {
        Object.keys(cachedChainIds).forEach(key => {
          if (key.includes(LEGACY_ATLASNET_RPC_URL) || cachedChainIds[key]?.value === LEGACY_ATLASNET_CHAIN_ID) {
            delete cachedChainIds[key];
          }
        });
        localStorage.setItem('FastRpcClient.cachedChainIDs', JSON.stringify(cachedChainIds));
      }

      const cachedEntrypoints = readLocalStorageList<{ key?: string }>('FastRpcClient.cachedEntrypoints');
      if (cachedEntrypoints) {
        localStorage.setItem(
          'FastRpcClient.cachedEntrypoints',
          JSON.stringify(cachedEntrypoints.filter(item => !item.key?.startsWith(`${LEGACY_ATLASNET_CHAIN_ID}:`)))
        );
      }
    }
  }
]);

function readLocalStorageRecord(key: string) {
  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as Record<string, { value?: string }>;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function readLocalStorageList<T>(key: string) {
  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
