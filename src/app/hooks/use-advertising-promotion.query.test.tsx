import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { advertisingKeys } from 'lib/query-keys';

import { useAdvertisingPromotionQuery } from './use-advertising-promotion.query';

jest.mock('app/store/root-state.selector', () => ({
  useSelector: (select: (state: unknown) => unknown) => select({ advertising: { activePromotion: {} } })
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('distinguishes absent advertising and reacts to Query without starting a disabled endpoint', async () => {
  const fetcher = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { queryFn: fetcher } } });
  let result: ReturnType<typeof useAdvertisingPromotionQuery> | undefined;
  function Consumer() {
    result = useAdvertisingPromotionQuery();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Consumer />
      </QueryClientProvider>
    )
  );
  expect(result?.data).toBeUndefined();
  expect(result?.isSuccess).toBe(false);
  expect(result?.isFetching).toBe(false);
  await act(async () => {
    client.setQueryData(advertisingKeys.active, { name: 'campaign' });
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(result?.data?.name).toBe('campaign');
  await act(async () => {
    await client.invalidateQueries(advertisingKeys.active);
  });
  expect(fetcher).not.toHaveBeenCalled();
  act(() => root.unmount());
  client.clear();
});
