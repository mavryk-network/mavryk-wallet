import { api } from './base';
import { buildQuery } from './build-query';

export const bakingBadGetBaker = buildQuery<BakingBadGetBakerParams, BakingBadGetBakerResponse>(
  api,
  'GET',
  ({ address }) => `/delegates/${address}`
);

const bakingBadGetKnownBakers = buildQuery<Omit<BakingBadGetBakerParams, 'address'>, BakingBadGetBakerResponse[]>(
  api,
  'GET',
  '/delegates',
  params => ({
    active: true,
    'stakedBalance.ne': 0,
    select: 'address,balance,stakedBalance',
    ...params
  })
);

export async function getAllBakersBakingBad() {
  const bakers = (await bakingBadGetKnownBakers({})).map(baker => ({
    ...baker,
    minDelegation: 0,
    estimatedRoi: 0,
    fee: 5
  }));

  return bakers.filter(baker => typeof baker !== 'string') as BakingBadBaker[];
}

type BakingBadGetBakerParams = {
  [x: string]: unknown;
};

export type BakingBadBaker = {
  address: string;
  balance: number;
  stakedBalance: number;
  estimatedRoi?: number;
  minDelegation?: number;
  freeSpace?: number;
  fee?: number;
  name?: string;
};

type BakingBadGetBakerResponse = BakingBadBaker | '';

export type BakingBadBakerValueHistoryItem<T> = {
  cycle: number;
  value: T;
};
