import { useCallback, useRef } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATIONS_SYNC_INTERVAL } from 'lib/fixed-times';
import { useIsNewsEnabled } from 'lib/store/zustand/ui.store';

import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationType } from '../enums/notification-type.enum';
import type { NotificationInterface } from '../types';
import { fetchNotifications } from '../utils/api.utils';

const NOTIFICATIONS_QUERY_KEY = ['notifications'];

const mergeNotifications = (
  prev: NotificationInterface[] | undefined,
  incoming: NotificationInterface[]
): NotificationInterface[] => {
  if (!prev) return incoming;

  return incoming.map(notification => {
    const existing = prev.find(item => item.id === notification.id);
    if (existing) {
      return { ...notification, status: existing.status };
    }
    return notification;
  });
};

export const useNotificationsQuery = () => {
  const startFromTimeRef = useRef(Date.now());
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async () => {
      const incoming = await fetchNotifications(startFromTimeRef.current);
      const prev = queryClient.getQueryData<NotificationInterface[]>(NOTIFICATIONS_QUERY_KEY);
      return mergeNotifications(prev, incoming);
    },
    staleTime: NOTIFICATIONS_SYNC_INTERVAL,
    refetchInterval: NOTIFICATIONS_SYNC_INTERVAL,
    refetchOnWindowFocus: false
  });
};

export const useNotifications = (): NotificationInterface[] => {
  const { data } = useNotificationsQuery();
  const isNewsEnabled = useIsNewsEnabled();
  const notifications = data ?? [];

  if (!isNewsEnabled) {
    return notifications.filter(n => n.type !== NotificationType.News);
  }
  return notifications;
};

export const useNotificationItem = (id: number): NotificationInterface | undefined => {
  const { data } = useNotificationsQuery();
  return (data ?? []).find(n => n.id === id);
};

export const useNewNotificationsAmount = (): number => {
  const notifications = useNotifications();
  return notifications.filter(n => n.status === NotificationStatus.New).length;
};

export const useViewAllNotifications = () => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.setQueryData<NotificationInterface[]>(NOTIFICATIONS_QUERY_KEY, prev => {
      if (!prev) return prev;
      return prev.map(n => (n.status === NotificationStatus.New ? { ...n, status: NotificationStatus.Viewed } : n));
    });
  }, [queryClient]);
};

export const useReadNotificationItem = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (notificationId: number) => {
      queryClient.setQueryData<NotificationInterface[]>(NOTIFICATIONS_QUERY_KEY, prev => {
        if (!prev) return prev;
        return prev.map(n => (n.id === notificationId ? { ...n, status: NotificationStatus.Read } : n));
      });
    },
    [queryClient]
  );
};
