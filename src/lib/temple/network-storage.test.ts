import browser from 'webextension-polyfill';

import { CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY } from 'lib/constants';

import {
  BASENET_NETWORK_ID,
  BASENET_RPC_URL,
  LEGACY_ATLASNET_CHAIN_ID,
  LEGACY_ATLASNET_NETWORK_ID,
  LEGACY_ATLASNET_RPC_URL,
  migrateLegacyAtlasnetStorage,
  NETWORK_ID_STORAGE_KEY,
  normalizeLegacyAtlasnetContactsSettings,
  normalizeLegacyAtlasnetScopedStorageKey,
  normalizeNetworkId
} from './network-storage';
import { TempleSettings } from './types';

describe('network-storage', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('normalizes legacy Atlasnet network ids', () => {
    expect(normalizeNetworkId(LEGACY_ATLASNET_NETWORK_ID)).toBe(BASENET_NETWORK_ID);
    expect(normalizeNetworkId('mainnet')).toBe('mainnet');
    expect(normalizeNetworkId(null)).toBeNull();
  });

  it('normalizes legacy Atlasnet scoped storage keys', () => {
    expect(normalizeLegacyAtlasnetScopedStorageKey('[mv1-wallet][atlasnet]')).toBe('[mv1-wallet][basenet]');
    expect(normalizeLegacyAtlasnetScopedStorageKey('[mv1-wallet][atlasnet][refresh]')).toBe(
      '[mv1-wallet][basenet][refresh]'
    );
    expect(normalizeLegacyAtlasnetScopedStorageKey('[mv1-wallet][mainnet]')).toBe('[mv1-wallet][mainnet]');
  });

  it('migrates plain browser storage entries scoped to Atlasnet', async () => {
    await browser.storage.local.set({
      [NETWORK_ID_STORAGE_KEY]: LEGACY_ATLASNET_NETWORK_ID,
      '[mv1-wallet][atlasnet]': 'legacy-access-token',
      '[mv1-wallet][atlasnet][refresh]': 'legacy-refresh-token',
      '[mv1-wallet][basenet]': 'existing-basenet-access-token',
      [`mv1-wallet_${LEGACY_ATLASNET_CHAIN_ID}_pending_transactions`]: [{ hash: 'old-op' }],
      [CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY]: [
        {
          id: LEGACY_ATLASNET_NETWORK_ID,
          name: 'Mavryk Atlasnet',
          description: 'Mavryk Atlasnet',
          rpcBaseURL: LEGACY_ATLASNET_RPC_URL,
          type: 'main',
          color: '#F86412',
          disabled: false
        }
      ]
    });

    await migrateLegacyAtlasnetStorage();

    const migratedStorage = await browser.storage.local.get(null);

    expect(migratedStorage[NETWORK_ID_STORAGE_KEY]).toBe(BASENET_NETWORK_ID);
    expect(migratedStorage['[mv1-wallet][basenet]']).toBe('existing-basenet-access-token');
    expect(migratedStorage['[mv1-wallet][basenet][refresh]']).toBe('legacy-refresh-token');
    expect(migratedStorage['[mv1-wallet][atlasnet]']).toBeUndefined();
    expect(migratedStorage['[mv1-wallet][atlasnet][refresh]']).toBeUndefined();
    expect(migratedStorage[`mv1-wallet_${LEGACY_ATLASNET_CHAIN_ID}_pending_transactions`]).toBeUndefined();
    expect(migratedStorage[CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY]).toEqual([
      {
        id: BASENET_NETWORK_ID,
        name: 'Mavryk Basenet',
        description: 'Mavryk Basenet',
        rpcBaseURL: BASENET_RPC_URL,
        type: 'main',
        color: '#F86412',
        disabled: false
      }
    ]);
  });

  it('migrates encrypted settings contacts keyed by Atlasnet', () => {
    const settings: TempleSettings = {
      contacts: [{ name: 'Legacy', address: 'mv1-legacy-contact' }],
      contactsApi: {
        accounts: {
          '[mv1-wallet][basenet]': {
            contacts: [{ name: 'Basenet', address: 'mv1-basenet-contact' }],
            recordId: 'basenet-record',
            typesByAddress: {
              'mv1-basenet-contact': 'user'
            }
          },
          '[mv1-wallet][atlasnet]': {
            contacts: [
              { name: 'Atlasnet', address: 'mv1-atlasnet-contact' },
              { name: 'Duplicate', address: 'mv1-basenet-contact' }
            ],
            recordId: 'atlasnet-record',
            typesByAddress: {
              'mv1-atlasnet-contact': 'validator',
              'mv1-basenet-contact': 'validator'
            }
          }
        }
      }
    };

    expect(normalizeLegacyAtlasnetContactsSettings(settings)).toEqual({
      contacts: [{ name: 'Legacy', address: 'mv1-legacy-contact' }],
      contactsApi: {
        accounts: {
          '[mv1-wallet][basenet]': {
            contacts: [
              { name: 'Basenet', address: 'mv1-basenet-contact' },
              { name: 'Atlasnet', address: 'mv1-atlasnet-contact' }
            ],
            recordId: 'basenet-record',
            typesByAddress: {
              'mv1-basenet-contact': 'user',
              'mv1-atlasnet-contact': 'validator'
            }
          }
        }
      }
    });
  });
});
