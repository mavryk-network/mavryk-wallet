import { useDispatch } from 'react-redux';

import { loadExchangeRates } from 'app/store/currency/actions';
import { RATES_SYNC_INTERVAL } from 'lib/fixed-times';
import { useInterval } from 'lib/ui/hooks';

import { useNotificationsQuery } from 'lib/notifications/hooks/use-notifications.query';

export const useLongRefreshLoading = () => {
  const dispatch = useDispatch();

  useInterval(() => dispatch(loadExchangeRates.submit()), RATES_SYNC_INTERVAL, []);

  // Notifications are now fetched via TanStack Query with refetchInterval.
  // Just mount the query hook to keep it active.
  useNotificationsQuery();
};
