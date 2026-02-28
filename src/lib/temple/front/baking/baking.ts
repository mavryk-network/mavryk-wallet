import { useCallback, useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import retry from 'async-retry';
import BigNumber from 'bignumber.js';

import { BoundaryError } from 'app/ErrorBoundary';
import { bakingKeys, chainKeys } from 'lib/query-keys';
import {
  BakingBadBaker,
  BakingBadBakerValueHistoryItem,
  bakingBadGetBaker,
  getAllBakersBakingBad,
  getBakerSpace
} from 'lib/apis/baking-bad';
import { getAccountStatsFromMvkt, isKnownChainId, MvktRewardsEntry, MvktAccountType } from 'lib/apis/mvkt';
import { fetchBakerDelegateParameters, MVKT_API_BASE_URLS, MvktApiChainId } from 'lib/apis/mvkt/api';
import type { MvktUserAccount } from 'lib/apis/mvkt/types';
import { getOnlineStatus } from 'lib/ui/get-online-status';

import { useChainId, useNetwork, useTezos } from '../ready';

import {
  DEFAULT_CYCLE_DURATION_MS,
  emptyAccountResponse,
  emptydelegateStatsResponse,
  PREDEFINED_BAKERS_NAMES_MAINNET
} from './const';
import { getCoStakeWaitTime, getDelegationWaitTime, getOneCycleinMs, getUnlockWaitTime } from './utils/delegateTime';

// -----------------------------------------

export function useDelegate<T = MvktUserAccount>(
  address: string,
  suspense = true,
  shouldPreventErrorPropagation = true
) {
  const tezos = useTezos();
  const chainId = useChainId(suspense);
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => [...chainKeys.delegate(tezos.checksum, address), chainId, shouldPreventErrorPropagation],
    [tezos.checksum, address, chainId, shouldPreventErrorPropagation]
  );

  const resetDelegateCache = useCallback(() => {
    queryClient.removeQueries({ queryKey });
  }, [queryClient, queryKey]);

  const getDelegate = useCallback(async (): Promise<T | undefined> => {
    try {
      return await retry(
        async () => {
          const freshChainId = chainId ?? (await tezos.rpc.getChainId());
          if (freshChainId && isKnownChainId(freshChainId)) {
            try {
              const accountStats = await getAccountStatsFromMvkt(address, freshChainId);

              switch (accountStats.type) {
                case MvktAccountType.Empty:
                  return emptyAccountResponse as T;
                case MvktAccountType.User:
                case MvktAccountType.Contract:
                  return accountStats as T;
              }
            } catch (e) {
              console.error(e);
            }
          }

          const delegateAddress = await tezos.rpc.getDelegate(address);
          return { delegate: { address: delegateAddress } } as T;
        },
        { retries: 3, minTimeout: 3000, maxTimeout: 5000 }
      );
    } catch (e) {
      if (shouldPreventErrorPropagation) {
        return emptyAccountResponse as T;
      }

      throw new BoundaryError(
        getOnlineStatus() ? 'errorGettingBakerAddressMessageOnline' : 'errorGettingBakerAddressMessage',
        resetDelegateCache
      );
    }
  }, [chainId, tezos, address, shouldPreventErrorPropagation, resetDelegateCache]);

  return useQuery<T | undefined>({
    queryKey,
    queryFn: getDelegate,
    staleTime: 20_000,
    refetchInterval: 15_000
  });
}

export function useAccountDelegatePeriodStats(accountAddress: string, shouldPreventErrorPropagation = true) {
  const { data: accStats } = useDelegate<MvktUserAccount>(accountAddress);
  const tezos = useTezos();
  const chainId = useChainId();
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => [...chainKeys.delegateStats(tezos.checksum, accountAddress), chainId, shouldPreventErrorPropagation],
    [tezos.checksum, accountAddress, chainId, shouldPreventErrorPropagation]
  );

  const resetDelegateStatsCache = useCallback(() => {
    queryClient.removeQueries({ queryKey });
  }, [queryClient, queryKey]);

  // ----------------------- delegate Stats -----------------------------

  const getDelegateStats = useCallback(async () => {
    try {
      return await retry(
        async () => {
          try {
            if (accStats?.delegate?.address) {
              const [blockMetadata, setDelegateParameters, unstakeRequests] = await Promise.all([
                tezos.rpc.getBlockMetadata(),
                fetchBakerDelegateParameters(accStats?.delegate?.address, chainId),
                tezos.rpc.getUnstakeRequests(accountAddress)
              ]);

              const currentCycle = blockMetadata?.level_info?.cycle ?? 0;
              const delegateCycle = setDelegateParameters?.activationCycle ?? -1;
              const limitOfStakingOverBaking = setDelegateParameters?.limitOfStakingOverBaking ?? 0;

              // ~2.8 days for mainnet // get cycle in Ms ------<
              let cycleDurationMs = DEFAULT_CYCLE_DURATION_MS.toNumber();

              try {
                const constants = await tezos.rpc.getConstants();
                cycleDurationMs = getOneCycleinMs(constants);
              } catch {
                console.error('Error getting RPC default constants');
              }
              // -----------------------------------

              const delegationWaitTime = getDelegationWaitTime(cycleDurationMs, accStats?.delegationTime || '');
              const costakeWaitTime = getCoStakeWaitTime(
                cycleDurationMs,
                currentCycle,
                delegateCycle,
                accStats?.stakedBalance,
                accStats?.unstakedBalance
              );

              const unlockWaitTime = getUnlockWaitTime(
                cycleDurationMs,
                currentCycle,
                unstakeRequests,
                accStats?.delegate?.address,
                accStats?.unstakedBalance
              );

              const hasDelegationPeriodPassed = delegationWaitTime === 'allowed';
              const isInCostakePeriod = costakeWaitTime !== 'allowed' && typeof costakeWaitTime === 'string';
              const isInUnlockPeriod = unlockWaitTime !== 'allowed' && typeof unlockWaitTime === 'string';
              const hasUnlockPeriodPassed = Boolean(accStats?.unstakedBalance) && unlockWaitTime === 'allowed';
              const canRedelegate = !isInUnlockPeriod && !hasUnlockPeriodPassed && !isInCostakePeriod;
              const canUnlockStake = !isInUnlockPeriod && !isInCostakePeriod;

              return {
                myBakerPkh: accStats?.delegate?.address ?? null,
                isDelegated: Boolean(accStats?.delegate?.address),
                isInDelegationPeriod: delegationWaitTime !== 'allowed',
                isInCostakePeriod,
                hasDelegationPeriodPassed: hasDelegationPeriodPassed,
                isInUnlockPeriod: isInUnlockPeriod,
                hasUnlockPeriodPassed: hasUnlockPeriodPassed,
                canRedelegate: canRedelegate,
                canCostake: !isInUnlockPeriod && !isInCostakePeriod && limitOfStakingOverBaking > 0,
                canUnlock: canUnlockStake,
                unlockWaitTime,
                costakeWaitTime,
                delegationWaitTime,
                stakedBalance: accStats?.stakedBalance ?? 0,
                unstakedBalance: accStats?.unstakedBalance ?? 0
              };
            }
          } catch (e) {
            console.error(e);
          }

          return emptydelegateStatsResponse;
        },
        { retries: 3, minTimeout: 3000, maxTimeout: 5000 }
      );
    } catch (e) {
      if (shouldPreventErrorPropagation) {
        return emptydelegateStatsResponse;
      }

      throw new BoundaryError(
        getOnlineStatus() ? 'errorGettingBakerAddressMessageOnline' : 'errorGettingBakerAddressMessage',
        resetDelegateStatsCache
      );
    }
  }, [
    accStats?.delegate?.address,
    accStats?.delegationTime,
    accStats?.stakedBalance,
    accStats?.unstakedBalance,
    tezos.rpc,
    chainId,
    accountAddress,
    shouldPreventErrorPropagation,
    resetDelegateStatsCache
  ]);

  return useQuery({
    queryKey,
    queryFn: getDelegateStats,
    staleTime: 20_000,
    refetchInterval: 15_000,
    placeholderData: emptydelegateStatsResponse
  });
}

export type AccDelegatePeriodStats = ReturnType<typeof useAccountDelegatePeriodStats>;

type RewardConfig = Record<
  | 'blocks'
  | 'endorses'
  | 'fees'
  | 'accusationRewards'
  | 'accusationLostDeposits'
  | 'accusationLostRewards'
  | 'accusationLostFees'
  | 'revelationRewards'
  | 'revelationLostRewards'
  | 'revelationLostFees'
  | 'missedBlocks'
  | 'stolenBlocks'
  | 'missedEndorses'
  | 'lowPriorityEndorses',
  boolean
>;
export type Baker = BakingBadBaker & {
  logo?: string;
  feeHistory?: BakingBadBakerValueHistoryItem<number>[];
  rewardConfigHistory?: BakingBadBakerValueHistoryItem<RewardConfig>[];
};

const defaultRewardConfigHistory = [
  {
    cycle: 0,
    value: {
      blocks: true,
      endorses: true,
      fees: true,
      accusationRewards: true,
      accusationLostDeposits: true,
      accusationLostRewards: true,
      accusationLostFees: true,
      revelationRewards: true,
      revelationLostRewards: true,
      revelationLostFees: true,
      missedBlocks: true,
      stolenBlocks: true,
      missedEndorses: true,
      lowPriorityEndorses: true
    }
  }
];

export function useKnownBaker(address: string | null) {
  const net = useNetwork();
  const chainId = useChainId();

  const fetchBaker = useCallback(async (): Promise<Baker | null> => {
    if (!address) return null;
    try {
      const baseUrlParams = chainId ? { baseURL: MVKT_API_BASE_URLS[chainId as MvktApiChainId] } : {};
      const bakingBadBaker = await bakingBadGetBaker({ address, configs: true, ...baseUrlParams });

      // @ts-expect-error // predifined validators list
      const predefinedBaker = PREDEFINED_BAKERS_NAMES_MAINNET[bakingBadBaker?.address];

      // TODO add necessary fields to the Baker type when new API is available
      if (typeof bakingBadBaker === 'object') {
        return {
          estimatedRoi: 0,
          ...bakingBadBaker,
          address: bakingBadBaker.address,
          stakedBalance: bakingBadBaker.stakedBalance,
          delegatedBalance: bakingBadBaker.delegatedBalance,
          balance: bakingBadBaker.balance,
          // @ts-expect-error // predifined validators list contains hardcoded svg logos
          logo: predefinedBaker ? predefinedBaker.logo : undefined,
          fee: predefinedBaker ? predefinedBaker.fee : 0,
          freeSpace: getBakerSpace(bakingBadBaker).toNumber(),
          name: predefinedBaker ? predefinedBaker.name : undefined,
          // stakingBalance: bakingBadBaker.stakingBalance,
          // feeHistory: bakingBadBaker.config?.fee,
          minDelegation: predefinedBaker ? predefinedBaker.minDelegation : undefined
          // rewardConfigHistory:
          //   bakingBadBaker.config?.rewardStruct.map(({ cycle, value: rewardStruct }) => ({
          //     cycle,
          //     value: {
          //       blocks: (rewardStruct & 1) > 0,
          //       endorses: (rewardStruct & 2) > 0,
          //       fees: (rewardStruct & 4) > 0,
          //       accusationRewards: (rewardStruct & 8) > 0,
          //       accusationLostDeposits: (rewardStruct & 16) > 0,
          //       accusationLostRewards: (rewardStruct & 32) > 0,
          //       accusationLostFees: (rewardStruct & 64) > 0,
          //       revelationRewards: (rewardStruct & 128) > 0,
          //       revelationLostRewards: (rewardStruct & 256) > 0,
          //       revelationLostFees: (rewardStruct & 512) > 0,
          //       missedBlocks: (rewardStruct & 1024) > 0,
          //       stolenBlocks: (rewardStruct & 2048) > 0,
          //       missedEndorses: (rewardStruct & 4096) > 0,
          //       lowPriorityEndorses: (rewardStruct & 8192) > 0
          //     }
          //   })) ?? defaultRewardConfigHistory
        };
      }

      return null;
    } catch (_err) {
      return null;
    }
  }, [address]);
  return useQuery({
    queryKey: bakingKeys.baker(address ?? ''),
    queryFn: fetchBaker,
    enabled: net.type === 'main' && !!address,
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 2
  });
}

// TODO uncomment the upper section  when new API is available
// export const useKnownBaker = (address: string | null, suspense = true) => {
//   const net = useNetwork();
//   const bakers = useKnownBakers(suspense);

//   const fetchBaker = useCallback(async () => {
//     if (!address) return null;
//     try {
//       return bakers?.find(b => b.address === address);
//     } catch (_err) {
//       return null;
//     }
//   }, [address]);

//   return useRetryableSWR(net.type === 'main' && address ? ['baker', address] : null, fetchBaker, {
//     refreshInterval: 120_000,
//     dedupingInterval: 60_000,
//     suspense
//   });
// };

export function useKnownBakers() {
  const chainId = useChainId();

  // eslint-disable-next-line no-type-assertion/no-type-assertion
  const baseApiUrl = chainId ? MVKT_API_BASE_URLS[chainId as MvktApiChainId] : '';

  const { data: bakers } = useQuery({
    queryKey: bakingKeys.bakers(baseApiUrl),
    queryFn: () => getAllBakersBakingBad(baseApiUrl),
    enabled: !!baseApiUrl,
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 2
  });

  return useMemo(
    () => (bakers && bakers.length > 1 ? bakers.filter(baker => !new BigNumber(baker.stakedBalance).isZero()) : null),
    [bakers]
  );
}

type RewardsStatsCalculationParams = {
  rewardsEntry: MvktRewardsEntry;
  bakerDetails: Baker | null | undefined;
  currentCycle: number | undefined;
} & Record<
  | 'fallbackRewardPerOwnBlock'
  | 'fallbackRewardPerEndorsement'
  | 'fallbackRewardPerFutureBlock'
  | 'fallbackRewardPerFutureEndorsement',
  BigNumber
>;

function getBakingEfficiency({ rewardsEntry, bakerDetails }: RewardsStatsCalculationParams) {
  const {
    cycle,
    ownBlockRewards,
    extraBlockRewards,
    futureBlockRewards,
    endorsementRewards,
    futureEndorsementRewards,
    ownBlocks,
    futureBlocks,
    futureEndorsements,
    endorsements,
    ownBlockFees,
    extraBlockFees,
    revelationRewards,
    doubleBakingRewards,
    doubleEndorsingRewards,
    missedEndorsementRewards,
    missedExtraBlockRewards,
    missedExtraBlockFees,
    missedOwnBlockFees,
    missedOwnBlockRewards
  } = rewardsEntry;
  let rewardConfig = defaultRewardConfigHistory[0].value;
  if (bakerDetails?.rewardConfigHistory) {
    const { rewardConfigHistory } = bakerDetails;
    for (const historyEntry of rewardConfigHistory) {
      if (cycle >= historyEntry.cycle) {
        rewardConfig = historyEntry.value;
        break;
      }
    }
  }
  const totalFutureRewards = new BigNumber(rewardConfig.endorses ? futureEndorsementRewards : 0).plus(
    rewardConfig.blocks ? futureBlockRewards : 0
  );
  const totalCurrentRewards = new BigNumber(
    rewardConfig.blocks ? new BigNumber(extraBlockRewards).plus(ownBlockRewards) : 0
  )
    .plus(rewardConfig.endorses ? new BigNumber(endorsementRewards).plus(doubleEndorsingRewards) : 0)
    .plus(rewardConfig.fees ? new BigNumber(ownBlockFees).plus(extraBlockFees) : 0)
    .plus(rewardConfig.revelationRewards ? revelationRewards : 0)
    .plus(doubleBakingRewards);
  const totalRewards = totalFutureRewards.plus(totalCurrentRewards);

  const fullEfficiencyIncome = new BigNumber(4e7)
    .multipliedBy(new BigNumber(ownBlocks).plus(futureBlocks))
    .plus(new BigNumber(1.25e6).multipliedBy(new BigNumber(endorsements).plus(futureEndorsements)));
  const totalLost = new BigNumber(missedEndorsementRewards)
    .plus(missedExtraBlockFees)
    .plus(missedExtraBlockRewards)
    .plus(missedOwnBlockFees)
    .plus(missedOwnBlockRewards);
  const totalGain = totalRewards.minus(totalLost).minus(fullEfficiencyIncome);
  return new BigNumber(1).plus(totalGain.div(fullEfficiencyIncome));
}

type CycleStatus = 'unlocked' | 'locked' | 'future' | 'inProgress';

export function getRewardsStats(params: RewardsStatsCalculationParams) {
  const { rewardsEntry, bakerDetails, currentCycle } = params;
  const {
    cycle,
    balance,
    ownBlockRewards,
    extraBlockRewards,
    futureBlockRewards,
    endorsementRewards,
    futureEndorsementRewards,
    stakingBalance,
    expectedBlocks,
    expectedEndorsements,
    ownBlockFees,
    extraBlockFees,
    revelationRewards,
    doubleBakingRewards,
    doubleEndorsingRewards
  } = rewardsEntry;

  const totalFutureRewards = new BigNumber(futureEndorsementRewards).plus(futureBlockRewards);
  const totalCurrentRewards = new BigNumber(extraBlockRewards)
    .plus(endorsementRewards)
    .plus(ownBlockRewards)
    .plus(ownBlockFees)
    .plus(extraBlockFees)
    .plus(revelationRewards)
    .plus(doubleBakingRewards)
    .plus(doubleEndorsingRewards);
  const cycleStatus: CycleStatus = (() => {
    switch (true) {
      case totalFutureRewards.eq(0) && (currentCycle === undefined || cycle <= currentCycle - 6):
        return 'unlocked';
      case totalFutureRewards.eq(0):
        return 'locked';
      case totalCurrentRewards.eq(0):
        return 'future';
      default:
        return 'inProgress';
    }
  })();
  const totalRewards = totalFutureRewards.plus(totalCurrentRewards);
  const rewards = totalRewards.multipliedBy(balance).div(stakingBalance);
  let luck = expectedBlocks + expectedEndorsements > 0 ? new BigNumber(-1) : new BigNumber(0);
  if (totalFutureRewards.plus(totalCurrentRewards).gt(0)) {
    luck = calculateLuck(params, totalRewards);
  }
  let bakerFeePart = bakerDetails?.fee ?? 0;
  if (bakerDetails?.feeHistory) {
    const { feeHistory } = bakerDetails;
    for (let i = 0; i < feeHistory.length; i++) {
      const historyEntry = feeHistory[i];
      if (cycle >= historyEntry.cycle) {
        bakerFeePart = historyEntry.value;
        break;
      }
    }
  }
  const bakerFee = rewards.multipliedBy(bakerFeePart);
  return {
    balance,
    rewards,
    luck,
    bakerFeePart,
    bakerFee,
    cycleStatus,
    efficiency: getBakingEfficiency(params)
  };
}

const calculateLuck = (params: RewardsStatsCalculationParams, totalRewards: BigNumber) => {
  const {
    rewardsEntry,
    fallbackRewardPerOwnBlock,
    fallbackRewardPerEndorsement,
    fallbackRewardPerFutureBlock,
    fallbackRewardPerFutureEndorsement
  } = params;
  const {
    ownBlockRewards,
    futureBlockRewards,
    endorsementRewards,
    futureEndorsementRewards,
    expectedBlocks,
    expectedEndorsements,
    ownBlocks,
    futureBlocks,
    futureEndorsements,
    endorsements
  } = rewardsEntry;
  const rewardPerOwnBlock = ownBlocks === 0 ? fallbackRewardPerOwnBlock : new BigNumber(ownBlockRewards).div(ownBlocks);
  const rewardPerEndorsement =
    endorsements === 0 ? fallbackRewardPerEndorsement : new BigNumber(endorsementRewards).div(endorsements);
  const asIfNoFutureExpectedBlockRewards = new BigNumber(expectedBlocks).multipliedBy(rewardPerOwnBlock);
  const asIfNoFutureExpectedEndorsementRewards = new BigNumber(expectedEndorsements).multipliedBy(rewardPerEndorsement);
  const asIfNoFutureExpectedRewards = asIfNoFutureExpectedBlockRewards.plus(asIfNoFutureExpectedEndorsementRewards);

  const rewardPerFutureBlock =
    futureBlocks === 0 ? fallbackRewardPerFutureBlock : new BigNumber(futureBlockRewards).div(futureBlocks);
  const rewardPerFutureEndorsement =
    futureEndorsements === 0
      ? fallbackRewardPerFutureEndorsement
      : new BigNumber(futureEndorsementRewards).div(futureEndorsements);
  const asIfNoCurrentExpectedBlockRewards = new BigNumber(expectedBlocks).multipliedBy(rewardPerFutureBlock);
  const asIfNoCurrentExpectedEndorsementRewards = new BigNumber(expectedEndorsements).multipliedBy(
    rewardPerFutureEndorsement
  );
  const asIfNoCurrentExpectedRewards = asIfNoCurrentExpectedBlockRewards.plus(asIfNoCurrentExpectedEndorsementRewards);

  const weights =
    endorsements + futureEndorsements === 0
      ? { current: ownBlocks, future: futureBlocks }
      : { current: endorsements, future: futureEndorsements };
  const totalExpectedRewards =
    weights.current + weights.future === 0
      ? new BigNumber(0)
      : asIfNoFutureExpectedRewards
          .multipliedBy(weights.current)
          .plus(asIfNoCurrentExpectedRewards.multipliedBy(weights.future))
          .div(new BigNumber(weights.current).plus(weights.future));

  return totalRewards.minus(totalExpectedRewards).div(totalExpectedRewards);
};
