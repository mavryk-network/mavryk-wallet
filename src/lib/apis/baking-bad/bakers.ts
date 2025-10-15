import BigNumber from 'bignumber.js';

import { PREDEFINED_BAKERS_NAMES_MAINNET } from 'lib/temple/front/baking/const';

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
    select: 'address,balance,stakedBalance,delegatedBalance',
    ...params
  })
);

export const getBakerSpace = (baker: BakingBadGetBakerResponse) => {
  if (baker) {
    const stakedBalance = new BigNumber(baker.stakedBalance).multipliedBy(5);
    const delegationBalance = stakedBalance.multipliedBy(9);
    return stakedBalance.plus(delegationBalance);
  }

  return new BigNumber(0);
};

export async function getAllBakersBakingBad(baseUrl: string) {
  const bakers = (await bakingBadGetKnownBakers({ baseURL: baseUrl })).map(baker => {
    // @ts-expect-error // predifined validators list
    const predefinedBaker = PREDEFINED_BAKERS_NAMES_MAINNET[baker?.address];

    return {
      ...baker,
      freeSpace: getBakerSpace(baker).toNumber(),
      minDelegation: 0,
      estimatedRoi: 0,
      fee: predefinedBaker ? predefinedBaker.fee : 0,
      name: predefinedBaker ? predefinedBaker.name : undefined,
      logo: predefinedBaker ? predefinedBaker.logo : undefined
    };
  });

  // eslint-disable-next-line no-type-assertion/no-type-assertion
  return bakers.filter(baker => typeof baker !== 'string') as BakingBadBaker[];
}

type BakingBadGetBakerParams = {
  [x: string]: unknown;
};

export type BakingBadBaker = {
  address: string;
  balance: number;
  stakedBalance: number;
  delegatedBalance: number;
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
