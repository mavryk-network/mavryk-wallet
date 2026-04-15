import { useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isDefined } from '@rnw-community/shared';
import { BigNumber } from 'bignumber.js';

import { Route3Dex, fetchRoute3Dexes$ } from 'lib/apis/route3/fetch-route3-dexes';
import { fetchRoute3SwapParams } from 'lib/apis/route3/fetch-route3-swap-params';
import { Route3Token, fetchgetRoute3Tokens } from 'lib/apis/route3/fetch-route3-tokens';
import {
  Route3SwapParamsRequest,
  Route3SwapParamsRequestRaw,
  Route3SwapParamsResponse,
  Route3TraditionalSwapParamsResponse
} from 'lib/route3/interfaces';
import { swapKeys } from 'lib/query-keys';
import { getRoute3TokenBySlug } from 'lib/route3/utils/get-route3-token-by-slug';
import { firstValueFrom } from 'rxjs';

const DEFAULT_SWAP_PARAMS: Route3TraditionalSwapParamsResponse = { input: undefined, output: undefined, chains: [] };

// --- Swap Tokens ---

export const useSwapTokensQuery = () =>
  useQuery({
    queryKey: swapKeys.tokens,
    queryFn: () => firstValueFrom(fetchgetRoute3Tokens()),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false
  });

export const useSwapTokensData = (): { data: Route3Token[]; isLoading: boolean } => {
  const { data, isLoading } = useSwapTokensQuery();
  return { data: data ?? [], isLoading };
};

export const useSwapTokenBySlug = (slug: string): Route3Token | undefined => {
  const { data } = useSwapTokensData();
  return useMemo(() => getRoute3TokenBySlug(data, slug), [data, slug]);
};

// --- Swap Dexes ---

export const useSwapDexesQuery = () =>
  useQuery({
    queryKey: swapKeys.dexes,
    queryFn: () => firstValueFrom(fetchRoute3Dexes$()),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false
  });

export const useSwapDexesData = (): { data: Route3Dex[]; isLoading: boolean } => {
  const { data, isLoading } = useSwapDexesQuery();
  return { data: data ?? [], isLoading };
};

// --- Swap Params ---

const isAmountValid = (params: Route3SwapParamsRequestRaw) =>
  isDefined(params.amount) &&
  new BigNumber(params.amount).isGreaterThan(0) &&
  params.fromSymbol.length > 0 &&
  params.toSymbol.length > 0;

export const useSwapParamsQuery = (params: Route3SwapParamsRequestRaw | null) => {
  const enabled = params !== null && isAmountValid(params);

  return useQuery<Route3SwapParamsResponse>({
    queryKey: enabled
      ? swapKeys.params(params!.fromSymbol, params!.toSymbol, String(params!.amount))
      : swapKeys.params('', '', ''),
    queryFn: () => fetchRoute3SwapParams(params as Route3SwapParamsRequest),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });
};

export const useSwapParamsData = (
  params: Route3SwapParamsRequestRaw | null
): {
  data: Route3SwapParamsResponse;
  isLoading: boolean;
  error: string | undefined;
} => {
  const { data, isLoading, error } = useSwapParamsQuery(params);
  return {
    data: data ?? DEFAULT_SWAP_PARAMS,
    isLoading,
    error: error ? String(error) : undefined
  };
};

export const useResetSwapParams = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.removeQueries({ queryKey: swapKeys.allParams });
  };
};
