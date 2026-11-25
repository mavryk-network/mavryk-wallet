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
    const stakedBalance = new BigNumber(baker.stakedBalance);

    const costakingCapacity = stakedBalance.multipliedBy(5);
    const delegationCapacity = stakedBalance.multipliedBy(9);
    const totalCapacity = costakingCapacity.plus(delegationCapacity);

    return totalCapacity.minus(baker?.stakedBalance ?? 0).minus(baker?.delegatedBalance ?? 0);
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
      minDelegation: predefinedBaker ? predefinedBaker.minDelegation : 0,
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
  id: number;
  type: string; // delegate
  address: string;
  active: boolean;
  publicKey: string;
  revealed: boolean;
  balance: number;
  rollupBonds: number;
  smartRollupBonds: number;
  stakedBalance: number;
  stakedPseudotokens: number;
  unstakedBalance: number;
  unstakedBaker: {
    address: string;
  };
  externalStakedBalance: number;
  externalUnstakedBalance: number;
  totalStakedBalance: number;
  issuedPseudotokens: number;
  stakersCount: number;
  lostBalance: number;
  counter: number;
  activationLevel: number;
  activationTime: string;
  stakingBalance: number;
  delegatedBalance: number;
  numContracts: number;
  rollupsCount: number;
  smartRollupsCount: number;
  activeTokensCount: number;
  tokenBalancesCount: number;
  tokenTransfersCount: number;
  activeTicketsCount: number;
  ticketBalancesCount: number;
  ticketTransfersCount: number;
  numDelegators: number;
  numBlocks: number;
  numEndorsements: number;
  numPreendorsements: number;
  numBallots: number;
  numProposals: number;
  numActivations: number;
  numDoubleBaking: number;
  numDoubleEndorsing: number;
  numDoublePreendorsing: number;
  numNonceRevelations: number;
  vdfRevelationsCount: number;
  numRevelationPenalties: number;
  numEndorsingRewards: number;
  numDelegations: number;
  numOriginations: number;
  numTransactions: number;
  numReveals: number;
  numRegisterConstants: number;
  numSetDepositsLimits: number;
  numMigrations: number;
  txRollupOriginationCount: number;
  txRollupSubmitBatchCount: number;
  txRollupCommitCount: number;
  txRollupReturnBondCount: number;
  txRollupFinalizeCommitmentCount: number;
  txRollupRemoveCommitmentCount: number;
  txRollupRejectionCount: number;
  txRollupDispatchTicketsCount: number;
  transferTicketCount: number;
  increasePaidStorageCount: number;
  updateConsensusKeyCount: number;
  drainDelegateCount: number;
  smartRollupAddMessagesCount: number;
  smartRollupCementCount: number;
  smartRollupExecuteCount: number;
  smartRollupOriginateCount: number;
  smartRollupPublishCount: number;
  smartRollupRecoverBondCount: number;
  smartRollupRefuteCount: number;
  refutationGamesCount: number;
  activeRefutationGamesCount: number;
  stakingOpsCount: number;
  autostakingOpsCount: number;
  firstActivity: number;
  firstActivityTime: string;
  lastActivity: number;
  lastActivityTime: string;
  software: {
    date: string;
  };
  frozenDeposit: number;
  frozenDeposits: number;
  frozenRewards: number;
  frozenFees: number;

  // not from the response at the moment, so they are added later on as hardcoded values
  fee?: number;
  estimatedRoi?: number;
  minDelegation?: number;
  freeSpace?: number;
  name?: string;
};

type BakingBadGetBakerResponse = BakingBadBaker | '';

export type BakingBadBakerValueHistoryItem<T> = {
  cycle: number;
  value: T;
};
