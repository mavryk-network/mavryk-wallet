import { createReducer } from '@reduxjs/toolkit';

import { NotificationStatus } from '../enums/notification-status.enum';

import {
  setIsNewsEnabledAction,
  readNotificationsItemAction,
  viewAllNotificationsAction,
  viewNotificationsAction
} from './actions';
import { notificationsInitialState, NotificationsState } from './state';

/** Retain the old list as a read-only upgrade source; only client choices can change here. */
export const notificationsReducer = createReducer<NotificationsState>(notificationsInitialState, builder => {
  const markViewed = (state: NotificationsState, ids: number[]) => {
    const statuses = (state.statuses ??= {});
    for (const id of ids) {
      const previous = statuses[id] ?? state.list.data.find(item => item.id === id)?.status;
      if (previous !== NotificationStatus.Read) statuses[id] = NotificationStatus.Viewed;
    }
  };
  builder.addCase(viewAllNotificationsAction, state =>
    markViewed(
      state,
      state.list.data.map(item => item.id)
    )
  );
  builder.addCase(viewNotificationsAction, (state, { payload }) => markViewed(state, payload));
  builder.addCase(readNotificationsItemAction, (state, { payload }) => {
    (state.statuses ??= {})[payload] = NotificationStatus.Read;
  });
  builder.addCase(setIsNewsEnabledAction, (state, { payload }) => {
    state.isNewsEnabled = payload;
  });
});
