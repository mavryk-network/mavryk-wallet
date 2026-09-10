import { useSelector } from 'app/store';
import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationType } from '../enums/notification-type.enum';

export const useNotificationsSelector = () => {
  const isNewsEnabled = useIsNewsEnabledSelector();
  const notifications = useSelector(state => state.notifications.list.data);
  return isNewsEnabled
    ? notifications
    : notifications.filter(notification => notification.type !== NotificationType.News);
};

export const useNotificationsItemSelector = (id: number) =>
  useSelector(state => state.notifications.list.data.find(notification => notification.id === id));

export const useNewNotificationsAmountSelector = () =>
  useNotificationsSelector().filter(notification => notification.status === NotificationStatus.New).length;

export const useIsNewsEnabledSelector = () => useOwnedUI(({ ui }) => ui.isNewsEnabled);
