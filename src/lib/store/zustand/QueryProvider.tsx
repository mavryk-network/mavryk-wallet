import React, { FC } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from './query-client';

/**
 * TanStack Query provider wrapper.
 *
 * Phase 5a: Added alongside existing Redux/SWR providers.
 * Components will gradually migrate from SWR → TanStack Query hooks.
 */
export const QueryProvider: FC<React.PropsWithChildren> = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
