import { z } from 'zod';

import { getAccountAssetsStoreKey } from 'lib/assets/account-assets-key';
import { AD_HIDING_TIMEOUT } from 'lib/constants';

import { ADULT_FLAGS_SCHEMA, ASSET_TO_PUT_SCHEMA } from './assets-state.schema';
import type { assetsStore } from './assets.store';
import { TOKEN_METADATA_SCHEMA } from './metadata-state.schema';
import type { metadataStore } from './metadata.store';
import type { uiStore } from './ui.store';
import { SAFE_KEY_SCHEMA } from './validation';

const categorySchema = z.enum(['tokens', 'collectibles', 'rwas']);
const accountSchema = ASSET_TO_PUT_SCHEMA.pick({ account: true, chainId: true });
export const ASSETS_COMMAND_SCHEMA = z.union([
  z.object({ kind: z.literal('assets-put'), category: categorySchema, records: z.array(ASSET_TO_PUT_SCHEMA) }).strict(),
  z
    .object({
      kind: z.literal('assets-status'),
      category: categorySchema,
      value: ASSET_TO_PUT_SCHEMA.omit({ manual: true })
    })
    .strict(),
  z
    .object({
      kind: z.literal('assets-loaded'),
      category: categorySchema,
      value: accountSchema.extend({ slugs: z.array(SAFE_KEY_SCHEMA) })
    })
    .strict(),
  z
    .object({
      kind: z.literal('adult-flags'),
      category: z.enum(['collectibles', 'rwas']),
      flags: ADULT_FLAGS_SCHEMA,
      timestamp: z.number().finite()
    })
    .strict(),
  z
    .object({
      kind: z.literal('nested-metadata'),
      category: z.enum(['collectiblesMetadata', 'rwasMetadata']),
      records: z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA)
    })
    .strict(),
  z.object({ kind: z.literal('promotion-toggle'), value: z.boolean() }).strict(),
  z.object({ kind: z.literal('promotion-hide'), id: SAFE_KEY_SCHEMA, timestamp: z.number().finite() }).strict()
]);
export type AssetsCommand = z.infer<typeof ASSETS_COMMAND_SCHEMA>;

/** Apply live producer semantics in the sole owner, against its latest state rather than stale foreground snapshots. */
export function applyAssetsCommand(
  command: AssetsCommand,
  stores: {
    assets: typeof assetsStore;
    ui: typeof uiStore;
    metadata: typeof metadataStore;
  }
) {
  const { assets, ui, metadata } = stores;
  if (command.kind === 'assets-put') {
    const put = {
      tokens: assets.getState().putTokensAsIs,
      collectibles: assets.getState().putCollectiblesAsIs,
      rwas: assets.getState().putRwasAsIs
    };
    put[command.category](command.records);
  } else if (command.kind === 'assets-status' || command.kind === 'assets-loaded') {
    assets.persistence
      .prepare(draft => {
        const { account, chainId } = command.value;
        const key = getAccountAssetsStoreKey(account, chainId);
        if (command.kind === 'assets-status') {
          const stored = draft[command.category][key]?.[command.value.slug];
          if (stored) stored.status = command.value.status;
        } else {
          const records = draft[command.category][key] ?? (draft[command.category][key] = {});
          const slugs = new Set(command.value.slugs);
          if (command.category !== 'tokens') {
            for (const [slug, stored] of Object.entries(records)) {
              if (!stored.manual && stored.status === 'idle' && !slugs.has(slug)) delete records[slug];
            }
          }
          for (const slug of slugs) if (!records[slug]) records[slug] = { status: 'idle' };
        }
      })
      .commit();
  } else if (command.kind === 'adult-flags') {
    const field = command.category === 'collectibles' ? 'collectibleAdultFlags' : 'rwaAdultFlags';
    const flags = { ...assets.getState()[field] };
    for (const [slug, { ts }] of Object.entries(flags)) {
      if (ts + 3 * 60 * 60 < command.timestamp) delete flags[slug];
    }
    Object.assign(flags, command.flags);
    if (command.category === 'collectibles') assets.getState().setCollectibleAdultFlags(flags);
    else assets.getState().setRwaAdultFlags(flags);
  } else if (command.kind === 'nested-metadata') {
    const put =
      command.category === 'collectiblesMetadata'
        ? metadata.getState().putCollectibleMetadataDirectly
        : metadata.getState().putRwaMetadataDirectly;
    for (const [slug, value] of Object.entries(command.records)) put(slug, value);
  } else {
    ui.persistence
      .prepare(draft => {
        if (command.kind === 'promotion-toggle') {
          draft.shouldShowPromotion = command.value;
          draft.promotionHidingTimestamps = {};
        } else {
          for (const [id, timestamp] of Object.entries(draft.promotionHidingTimestamps)) {
            if (timestamp < command.timestamp - AD_HIDING_TIMEOUT * 2) delete draft.promotionHidingTimestamps[id];
          }
          draft.promotionHidingTimestamps[command.id] = command.timestamp;
        }
      })
      .commit();
  }
}
