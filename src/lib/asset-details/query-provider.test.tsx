import React from 'react';

import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { DetailsQueryProvider } from './query-provider';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('retains one cache across provider renders and clears it at foreground teardown', () => {
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const clients: QueryClient[] = [];
  function Consumer() {
    clients.push(useQueryClient());
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() =>
    root.render(
      <DetailsQueryProvider>
        <Consumer />
      </DetailsQueryProvider>
    )
  );
  clients[0].setQueryData(['test'], 'cached');
  act(() =>
    root.render(
      <DetailsQueryProvider>
        <Consumer />
      </DetailsQueryProvider>
    )
  );
  expect(clients[1]).toBe(clients[0]);
  expect(clients[1].getQueryData(['test'])).toBe('cached');
  act(() => root.unmount());
  expect(clients[0].getQueryCache().getAll()).toHaveLength(0);
  logger.mockRestore();
});
