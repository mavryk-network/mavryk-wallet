import React, { useEffect, useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** One ephemeral cache per foreground provider; no persisted wallet data enters this cache. */
export const DetailsQueryProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, cacheTime: 5 * 60_000 } },
        logger: {
          log: () => undefined,
          warn: () => undefined,
          // Driver errors are observed and logged with a fixed message; Query must not print API payloads.
          error: () => undefined
        }
      })
  );

  // Release foreground cache requests on teardown; child drivers also release their registrations and timers.
  useEffect(() => () => client.clear(), [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
