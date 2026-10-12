import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { useNotificationsQuery } from '../hooks/use-notifications.query';
import { NotificationInterface } from '../types';

const EMPTY_NOTIFICATIONS: NotificationInterface[] = [];

export const useNotificationsSelector = () => {
  const isNewsEnabled = useIsNewsEnabledSelector();
  const notifications = useNotificationsQuery().data ?? EMPTY_NOTIFICATIONS;
  return isNewsEnabled
    ? notifications
    : notifications.filter(notification => notification.type !== NotificationType.News);
};

export const useNotificationsItemSelector = (id: number) =>
  useNotificationsQuery().data?.find(notification => notification.id === id);

export const useNewNotificationsAmountSelector = () =>
  useNotificationsSelector().filter(notification => notification.status === NotificationStatus.New).length;

export const useIsNewsEnabledSelector = () => useOwnedUI(({ ui }) => ui.isNewsEnabled);
