import { z } from 'zod';

import type { AssetToPut } from 'app/store/assets/actions';
import type { CollectiblesState } from 'app/store/collectibles/state';
import type { RwasState } from 'app/store/rwas/state';
import { getAccountAssetsStoreKey } from 'lib/assets/account-assets-key';

import { createDestinationStore } from './destination-store';
import { BrowserStorage } from './persist-storage';
import { parseData, SAFE_KEY_SCHEMA } from './validation';

const STORED_ASSET_SCHEMA = z.object({
  status: z.enum(['idle', 'enabled', 'disabled', 'removed']),
  manual: z.boolean().optional()
});
const ASSET_TO_PUT_SCHEMA = STORED_ASSET_SCHEMA.extend({
  slug: SAFE_KEY_SCHEMA,
  account: SAFE_KEY_SCHEMA.refine(value => !value.includes('@')),
  chainId: SAFE_KEY_SCHEMA.refine(value => !value.includes('@'))
});
const ASSET_RECORDS_SCHEMA = z.record(
  SAFE_KEY_SCHEMA.refine(value => /^[^@]+@[^@]+$/.test(value)),
  z.record(SAFE_KEY_SCHEMA, STORED_ASSET_SCHEMA)
);
const ADULT_FLAGS_SCHEMA = z.record(SAFE_KEY_SCHEMA, z.object({ val: z.boolean(), ts: z.number().finite() }));
const ASSETS_SCHEMA = z.object({
  tokens: ASSET_RECORDS_SCHEMA,
  collectibles: ASSET_RECORDS_SCHEMA,
  rwas: ASSET_RECORDS_SCHEMA,
  collectibleAdultFlags: ADULT_FLAGS_SCHEMA,
  rwaAdultFlags: ADULT_FLAGS_SCHEMA
});

export type AssetsState = z.infer<typeof ASSETS_SCHEMA>;

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
