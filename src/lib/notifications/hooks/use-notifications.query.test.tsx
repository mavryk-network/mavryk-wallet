import React from 'react';

import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { notificationKeys } from 'lib/query-keys';

import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { readNotificationsItemAction, viewNotificationsAction } from '../store/actions';
import { notificationsReducer } from '../store/reducers';
import { notificationsInitialState, NotificationsState } from '../store/state';

import { useNotificationsQuery } from './use-notifications.query';

const legacyList = {
  ...notificationsInitialState.list,
  data: [
    {
      id: 1,
      status: NotificationStatus.New,
      createdAt: '',
      type: NotificationType.News,
      platforms: [],
      language: 'en',
      title: 'News',
      description: '',
      content: [],
      extensionImageUrl: '',
      mobileImageUrl: ''
    }
  ]
};
let mockState: NotificationsState = { ...notificationsInitialState, list: legacyList };
jest.mock('app/store/root-state.selector', () => ({
  useSelector: (select: (state: unknown) => unknown) => select({ notifications: mockState })
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('keeps the feed dormant and durable read choices separate from cached content', async () => {
  const fetcher = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { queryFn: fetcher } } });
  let result: ReturnType<typeof useNotificationsQuery> | undefined;
  function Consumer() {
    result = useNotificationsQuery();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  const render = () => {
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Consumer />
        </QueryClientProvider>
      )
    );
  };
  render();
  const key = notificationKeys.list(mockState.startFromTime);
  const content = client.getQueryData(key);
  const id = mockState.list.data[0].id;
  mockState = notificationsReducer(mockState, readNotificationsItemAction(id));
  mockState = notificationsReducer(mockState, viewNotificationsAction([id]));
  render();
  expect(result?.data?.[0].status).toBe(NotificationStatus.Read);
  expect(client.getQueryData(key)).toBe(content);
  expect(mockState.list).toBe(legacyList);
  await act(async () => {
    await client.invalidateQueries(key);
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(result?.isFetching).toBe(false);
  expect(notificationKeys.list(1)).not.toEqual(notificationKeys.list(2));
  act(() => root.unmount());
  client.clear();
});
