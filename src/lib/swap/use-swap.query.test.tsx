import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { swapInitialState } from 'app/store/swap/state';
import { swapKeys } from 'lib/query-keys';

import { useSwapDexesQuery, useSwapTokensQuery } from './use-swap.query';

jest.mock('app/store/root-state.selector', () => ({
  useSelector: (select: (state: unknown) => unknown) => select({ swap: swapInitialState })
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('reacts to list cache updates without activating dormant endpoints or touching quotes', async () => {
  const fetcher = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { queryFn: fetcher } } });
  let tokens: ReturnType<typeof useSwapTokensQuery> | undefined;
  let dexes: ReturnType<typeof useSwapDexesQuery> | undefined;
  function Consumer() {
    tokens = useSwapTokensQuery();
    dexes = useSwapDexesQuery();
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
  expect(tokens?.data).toEqual([]);
  expect(tokens?.isLoading).toBe(false);
  await act(async () => {
    client.setQueryData(swapKeys.tokens, [{ id: 42 }]);
    client.setQueryData(swapKeys.dexes, [{ id: 'dex' }]);
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(tokens?.data).toEqual([{ id: 42 }]);
  expect(dexes?.data).toEqual([{ id: 'dex' }]);
  await act(async () => {
    await client.invalidateQueries(['swap']);
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(swapInitialState.tokens.data).toEqual([]);
  expect(client.getQueryCache().findAll(swapKeys.allParams)).toHaveLength(0);
  act(() => root.unmount());
  client.clear();
});
