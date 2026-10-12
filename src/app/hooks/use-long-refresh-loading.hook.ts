import { useDispatch } from 'react-redux';

import { NOTIFICATIONS_SYNC_INTERVAL } from 'lib/fixed-times';
import { loadNotificationsAction } from 'lib/notifications';
import { useInterval } from 'lib/ui/hooks';

import { useExchangeRatesQuery } from './use-exchange-rates.query';

export const useLongRefreshLoading = () => {
  const dispatch = useDispatch();

  useExchangeRatesQuery(true);

  useInterval(() => dispatch(loadNotificationsAction.submit()), NOTIFICATIONS_SYNC_INTERVAL, []);
};
