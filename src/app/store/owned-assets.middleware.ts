import type { Middleware } from '@reduxjs/toolkit';

import { fromAssetSlug } from 'lib/assets/utils';
import { isRwa } from 'lib/metadata/classification';
import { buildTokenMetadataFromFetched } from 'lib/metadata/utils';
import type { AssetsCommand } from 'lib/store/zustand/assets-command';
import { updateOwnedUI } from 'lib/store/zustand/ui-client';

import * as assets from './assets/actions';
import { loadCollectiblesDetailsActions } from './collectibles/actions';
import { putCollectiblesMetadataAction, resetCollectiblesMetadataLoadingAction } from './collectibles-metadata/actions';
import { hidePromotionAction, togglePartnersPromotionAction } from './partners-promotion/actions';
import type { RootState } from './root-state.type';
import { loadRwasDetailsActions } from './rwas/actions';
import { putRwasMetadataAction, resetRwasMetadataLoadingAction } from './rwas-metadata/actions';

/** Compatibility commands cover every existing producer, including the unchanged IndexedDB migration actions. */
export const ownedAssetsMiddleware: Middleware<{}, RootState> = api => next => action => {
  let command: AssetsCommand | undefined;
  let shouldContinue = false;
  let resetLoading: (() => unknown) | undefined;
  for (const [category, put, status, loaded] of [
    ['tokens', assets.putTokensAsIsAction, assets.setTokenStatusAction, assets.loadAccountTokensActions.success],
    [
      'collectibles',
      assets.putCollectiblesAsIsAction,
      assets.setCollectibleStatusAction,
      assets.loadAccountCollectiblesActions.success
    ],
    ['rwas', assets.putRwasAsIsAction, assets.setRwaStatusAction, assets.loadAccountRwasActions.success]
  ] as const) {
    if (put.match(action)) command = { kind: 'assets-put', category, records: action.payload };
    else if (status.match(action)) command = { kind: 'assets-status', category, value: action.payload };
    else if (loaded.match(action)) {
      command = { kind: 'assets-loaded', category, value: action.payload };
      shouldContinue = true; // Loading/error state still belongs to Redux.
    }
  }
  if (loadCollectiblesDetailsActions.success.match(action) || loadRwasDetailsActions.success.match(action)) {
    const isCollectible = loadCollectiblesDetailsActions.success.match(action);
    const timestamp = Math.round(action.payload.timestamp / 1000);
    command = { kind: 'adult-flags', category: isCollectible ? 'collectibles' : 'rwas', flags: {}, timestamp };
    for (const [slug, details] of Object.entries(action.payload.details)) {
      if (details)
        command.flags[slug] = {
          val: isCollectible ? details.isAdultContent! : details.isAdultContent ?? false,
          ts: timestamp
        };
    }
    shouldContinue = true; // Fetched details and their loading state remain Redux-owned.
  } else if (putCollectiblesMetadataAction.match(action) || putRwasMetadataAction.match(action)) {
    const isCollectible = putCollectiblesMetadataAction.match(action);
    command = {
      kind: 'nested-metadata',
      category: isCollectible ? 'collectiblesMetadata' : 'rwasMetadata',
      records: {}
    };
    for (const [slug, raw] of Object.entries(action.payload.records)) {
      if (!raw || (!isCollectible && !isRwa(raw))) continue;
      const [address, id] = fromAssetSlug(slug);
      if (id) command.records[slug] = buildTokenMetadataFromFetched(raw, address, id);
    }
    if (action.payload.resetLoading)
      resetLoading = () =>
        api.dispatch(isCollectible ? resetCollectiblesMetadataLoadingAction() : resetRwasMetadataLoadingAction());
  } else if (togglePartnersPromotionAction.match(action)) command = { kind: 'promotion-toggle', value: action.payload };
  else if (hidePromotionAction.match(action)) command = { kind: 'promotion-hide', ...action.payload };
  if (!command) return next(action);
  // The shared owner gate exposes persistence errors and supports retry; Redux cannot become a fallback writer.
  void updateOwnedUI(command)
    .then(() => {
      resetLoading?.();
    })
    .catch(() => undefined);
  return shouldContinue ? next(action) : action;
};
