import { useMemo } from 'react';

import { useSelector } from 'app/store/root-state.selector';
import { useDormantQuery } from 'lib/query/use-dormant-query';
import { swapKeys } from 'lib/query-keys';
import { createEntity } from 'lib/store';

/** Route3 list endpoints remain disabled; persisted lists are read-only upgrade seeds. Quotes stay Redux-owned. */
export const useSwapTokensQuery = () => {
  const legacy = useSelector(state => state.swap.tokens.data);
  const query = useDormantQuery(swapKeys.tokens, legacy.length ? legacy : undefined);
  return useMemo(
    () => createEntity(query.data ?? legacy, query.isFetching, query.error?.message),
    [query.data, query.isFetching, query.error, legacy]
  );
};

export const useSwapDexesQuery = () => {
  const legacy = useSelector(state => state.swap.dexes.data);
  const query = useDormantQuery(swapKeys.dexes, legacy.length ? legacy : undefined);
  return useMemo(
    () => createEntity(query.data ?? legacy, query.isFetching, query.error?.message),
    [query.data, query.isFetching, query.error, legacy]
  );
};
