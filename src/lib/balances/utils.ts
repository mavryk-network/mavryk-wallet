import { atomsToTokens } from 'lib/temple/helpers';

export const getKeyForBalancesRecord = (publicKeyHash: string, chainId: string) => `${publicKeyHash}_${chainId}`;

const YUPANA_TOKENS = [
  'KT1Rk86CX85DjBKmuyBhrCyNsHyudHVtASec_0',
  'KT1Rk86CX85DjBKmuyBhrCyNsHyudHVtASec_2',
  'KT1Rk86CX85DjBKmuyBhrCyNsHyudHVtASec_3',
  'KT1Rk86CX85DjBKmuyBhrCyNsHyudHVtASec_4',
  'KT1Rk86CX85DjBKmuyBhrCyNsHyudHVtASec_5',
  'KT1Rk86CX85DjBKmuyBhrCyNsHyudHVtASec_6'
];
const YUPANA_MULTIPLIER = 18;

export const fixBalances = (balances: StringRecord): StringRecord => {
  const result = { ...balances };
  for (const slug of YUPANA_TOKENS) {
    const balance = result[slug];
    if (balance) result[slug] = atomsToTokens(balance, YUPANA_MULTIPLIER).toFixed();
  }

  return result;
};
