import { useOwnedUI } from 'lib/store/zustand/ui-client';

export const useUserIdSelector = () =>
  useOwnedUI(({ ui }) => {
    if (!ui.userId) throw new Error('Analytics identity has not been restored');
    return ui.userId;
  });
export const useAnalyticsEnabledSelector = () => useOwnedUI(({ ui }) => ui.isAnalyticsEnabled);
export const useBalanceModeSelector = () => useOwnedUI(({ ui }) => ui.balanceMode);
export const useOnRampPossibilitySelector = () => useOwnedUI(({ ui }) => ui.isOnRampPossibility);
