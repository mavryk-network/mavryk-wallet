import { createEntity, LoadableEntityState } from 'lib/store';

import type { NotificationStatus } from '../enums/notification-status.enum';
import type { NotificationInterface } from '../types';

export interface NotificationsState {
  startFromTime: number;
  statuses?: Record<number, NotificationStatus>;
  list: LoadableEntityState<NotificationInterface[]>;
  isNewsEnabled: boolean;
}

export const notificationsInitialState: NotificationsState = {
  startFromTime: new Date().getTime(),
  list: createEntity([]),
  isNewsEnabled: true
};
