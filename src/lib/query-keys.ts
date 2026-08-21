import { Route3SwapParamsRequestRaw } from 'lib/route3/interfaces';

type SwapParamsRequestKeyFields = {
  [K in keyof Route3SwapParamsRequestRaw]-?: Route3SwapParamsRequestRaw[K] | null;
};

const getSwapParamsRequestKeyFields = (params: Route3SwapParamsRequestRaw): SwapParamsRequestKeyFields => ({
  fromSymbol: params.fromSymbol,
  toSymbol: params.toSymbol,
  amount: params.amount ?? null,
  chainsLimit: params.chainsLimit ?? null
});

export const serializeQueryKey = (key: readonly unknown[]) => JSON.stringify(key) ?? '';

export const swapKeys = {
  tokens: ['swap', 'tokens'] as const,
  dexes: ['swap', 'dexes'] as const,
  allParams: ['swap', 'params'] as const,
  params: (account: string, chainId: string, params: Route3SwapParamsRequestRaw) => {
    const fields = getSwapParamsRequestKeyFields(params);

    return [
      ...swapKeys.allParams,
      account,
      chainId,
      fields.fromSymbol,
      fields.toSymbol,
      fields.amount,
      fields.chainsLimit
    ] as const;
  }
};
