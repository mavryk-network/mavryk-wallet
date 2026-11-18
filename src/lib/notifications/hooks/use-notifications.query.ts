import { useMemo } from 'react';

import { useSelector } from 'app/store/root-state.selector';
import { useDormantQuery } from 'lib/query/use-dormant-query';
import { notificationKeys } from 'lib/query-keys';

/** The disabled feed adopts retained legacy content once per cache entry; read choices remain durable Redux state. */
export const useNotificationsQuery = () => {
  const { startFromTime, list, statuses } = useSelector(state => state.notifications);
  const query = useDormantQuery(notificationKeys.list(startFromTime), list.data.length ? list.data : undefined);
  const data = useMemo(
    () => query.data?.map(item => ({ ...item, status: statuses?.[item.id] ?? item.status })),
    [query.data, statuses]
  );
  return { ...query, data };
};
