import { useExchangeRatesQuery } from 'app/hooks/use-exchange-rates.query';
import { useNotificationsQuery } from 'lib/notifications/hooks/use-notifications.query';

/**
 * Keeps long-refresh data queries active.
 * TanStack Query handles refetchInterval for both exchange rates and notifications.
 */
export const useLongRefreshLoading = () => {
  useExchangeRatesQuery();
  useNotificationsQuery();
};
