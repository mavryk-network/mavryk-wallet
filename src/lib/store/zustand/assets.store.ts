import { z } from 'zod';

import type { AssetToPut } from 'app/store/assets/actions';
import type { CollectiblesState } from 'app/store/collectibles/state';
import type { RwasState } from 'app/store/rwas/state';
import { getAccountAssetsStoreKey } from 'lib/assets/account-assets-key';

import { ASSET_TO_PUT_SCHEMA, ASSETS_SCHEMA } from './assets-state.schema';
import { createDestinationStore } from './destination-store';
import { BrowserStorage } from './persist-storage';
import { parseData } from './validation';
export type { AssetsState } from './assets-state.schema';

/** Upsert explicit statuses/manual values; adult flags retain legacy slug -> {val, ts seconds} semantics. */
export function createAssetsStore(storage?: BrowserStorage) {
  return createDestinationStore({
    name: 'zustand-assets',
    storage,
    schema: ASSETS_SCHEMA,
    defaults: { tokens: {}, collectibles: {}, rwas: {}, collectibleAdultFlags: {}, rwaAdultFlags: {} },
    actions: update => {
      const put = (category: 'tokens' | 'collectibles' | 'rwas', assets: AssetToPut[]) => {
        const validated = parseData(z.array(ASSET_TO_PUT_SCHEMA), assets);
        update(draft => {
          for (const { account, chainId, slug, status, manual } of validated) {
            const key = getAccountAssetsStoreKey(account, chainId);
            if (!draft[category][key]) draft[category][key] = {};
            draft[category][key][slug] = manual === undefined ? { status } : { status, manual };
          }
        });
      };
      return {
        putTokensAsIs: (assets: AssetToPut[]) => put('tokens', assets),
        putCollectiblesAsIs: (assets: AssetToPut[]) => put('collectibles', assets),
        putRwasAsIs: (assets: AssetToPut[]) => put('rwas', assets),
        setCollectibleAdultFlags: (flags: CollectiblesState['adultFlags']) =>
          update(draft => {
            draft.collectibleAdultFlags = flags;
          }),
        setRwaAdultFlags: (flags: RwasState['adultFlags']) =>
          update(draft => {
            draft.rwaAdultFlags = flags;
          })
      };
    }
  });
}

export const assetsStore = createAssetsStore();
