import type { UIPreferences, UIState } from './ui-state.schema';

/** Apply validated scalar preferences to a prepared draft; callers commit only after all drafts pass validation. */
export function applyUIPreferences(
  draft: UIState,
  values: Omit<UIPreferences, 'lastSeenPromotionName'> & { lastSeenPromotionName?: string | null }
): void {
  if (values.isAnalyticsEnabled !== undefined) draft.isAnalyticsEnabled = values.isAnalyticsEnabled;
  if (values.balanceMode !== undefined) draft.balanceMode = values.balanceMode;
  if (values.isOnRampPossibility !== undefined) draft.isOnRampPossibility = values.isOnRampPossibility;
  if (values.abTestGroupName !== undefined) draft.abTestGroupName = values.abTestGroupName;
  if (values.shouldShowNewsletterModal !== undefined)
    draft.shouldShowNewsletterModal = values.shouldShowNewsletterModal;
  if (values.isNewsEnabled !== undefined) draft.isNewsEnabled = values.isNewsEnabled;
  if (Object.prototype.hasOwnProperty.call(values, 'lastSeenPromotionName'))
    draft.lastSeenPromotionName = values.lastSeenPromotionName ?? undefined;
}
