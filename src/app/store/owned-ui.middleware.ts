import type { Middleware } from '@reduxjs/toolkit';

import { fromAssetSlug, toTokenSlug } from 'lib/assets/utils';
import { buildTokenMetadataFromFetched, buildTokenMetadataFromWhitelist } from 'lib/metadata/utils';
import { setIsNewsEnabledAction } from 'lib/notifications/store/actions';
import { updateOwnedUI } from 'lib/store/zustand/ui-client';
import type { UICommand } from 'lib/store/zustand/ui-owner.contract';

import { getUserTestingGroupNameActions } from './ab-testing/actions';
import { skipAdvertisingPromotionAction } from './advertising/actions';
import { shouldShowNewsletterModalAction } from './newsletter/newsletter-actions';
import type { RootState } from './root-state.type';
import { setIsAnalyticsEnabledAction, setOnRampPossibilityAction, toggleBalanceModeAction } from './settings/actions';
import {
  addWhitelistTokensMetadataAction,
  putTokensMetadataAction,
  refreshTokensMetadataAction,
  resetTokensMetadataLoadingAction
} from './tokens-metadata/actions';

/** Existing actions are commands only for converted fields. They never reach the old Redux writers. */
export const ownedUIMiddleware: Middleware<{}, RootState> = api => next => action => {
  let command: UICommand | undefined;
  if (setIsAnalyticsEnabledAction.match(action))
    command = { kind: 'preferences', values: { isAnalyticsEnabled: action.payload } };
  else if (setOnRampPossibilityAction.match(action))
    command = { kind: 'preferences', values: { isOnRampPossibility: action.payload } };
  else if (toggleBalanceModeAction.match(action))
    command = { kind: 'preferences', values: { balanceMode: action.payload } };
  else if (getUserTestingGroupNameActions.success.match(action))
    command = { kind: 'preferences', values: { abTestGroupName: action.payload } };
  else if (shouldShowNewsletterModalAction.match(action))
    command = { kind: 'preferences', values: { shouldShowNewsletterModal: action.payload } };
  else if (setIsNewsEnabledAction.match(action))
    command = { kind: 'preferences', values: { isNewsEnabled: action.payload } };
  else if (skipAdvertisingPromotionAction.match(action))
    command = {
      kind: 'preferences',
      values: { lastSeenPromotionName: api.getState().advertising.activePromotion.data?.name ?? null }
    };
  else if (putTokensMetadataAction.match(action) || refreshTokensMetadataAction.match(action)) {
    const records = putTokensMetadataAction.match(action) ? action.payload.records : action.payload;
    command = { kind: 'metadata', mode: refreshTokensMetadataAction.match(action) ? 'refresh' : 'put', records: {} };
    for (const [slug, raw] of Object.entries(records)) {
      const [address, id] = fromAssetSlug(slug);
      if (raw && id) command.records[slug] = buildTokenMetadataFromFetched(raw, address, id);
    }
  } else if (addWhitelistTokensMetadataAction.match(action)) {
    command = { kind: 'metadata', mode: 'whitelist', records: {} };
    for (const raw of action.payload) {
      command.records[toTokenSlug(raw.contractAddress, raw.fa2TokenId)] = buildTokenMetadataFromWhitelist(raw);
    }
  }
  if (!command) return next(action);
  const shouldResetLoading = putTokensMetadataAction.match(action) && action.payload.resetLoading;
  // Saving errors are shown by the shared readiness gate. Redux never becomes a fallback writer.
  void updateOwnedUI(command)
    .then(() => {
      if (shouldResetLoading) api.dispatch(resetTokensMetadataLoadingAction());
    })
    .catch(() => undefined);
  return action;
};
