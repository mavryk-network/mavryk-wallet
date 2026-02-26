import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { useUserTestingGroupNameSelector } from 'app/store/ab-testing/selectors';
import { getDelegatorRewards, isKnownChainId } from 'lib/apis/tzkt';
import { useRetryableSWR } from 'lib/swr';
import { useAccount, useChainId, useDelegate } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';

// type RewardsPerEventHistoryItem = Partial<
//   Record<
//     'rewardPerOwnBlock' | 'rewardPerEndorsement' | 'rewardPerFutureBlock' | 'rewardPerFutureEndorsement',
//     BigNumber
//   >
// >;
// const allRewardsPerEventKeys: (keyof RewardsPerEventHistoryItem)[] = [
//   'rewardPerOwnBlock',
//   'rewardPerEndorsement',
//   'rewardPerFutureBlock',
//   'rewardPerFutureEndorsement'
// ];

export const useBakingHistory = () => {
  const acc = useAccount();
  const { data: accStats } = useDelegate(acc.publicKeyHash);

  const myBakerPkh = accStats?.delegate?.address || null;
  const canDelegate = acc.type !== TempleAccountType.WatchOnly;
  const chainId = useChainId(true);
  const testGroupName = useUserTestingGroupNameSelector();

  const getBakingHistory = useCallback(
    async ([, accountPkh, , chainId]: [string, string, string | nullish, string | nullish]) => {
      if (!isKnownChainId(chainId!)) {
        return [];
      }
      return (
        (await getDelegatorRewards(chainId, {
          address: accountPkh,
          limit: 30
        })) || []
      );
    },
    []
  );
  const { data: bakingHistory, isValidating: loadingBakingHistory } = useRetryableSWR(
    ['baking-history', acc.publicKeyHash, myBakerPkh, chainId],
    getBakingHistory,
    { suspense: true, revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const rewardsPerEventHistory = useMemo(() => {
    if (!bakingHistory) {
      return [];
    }
    return bakingHistory.map(historyItem => {
      const {
        endorsements,
        endorsementRewards,
        futureBlocks,
        futureBlockRewards,
        futureEndorsements,
        futureEndorsementRewards,
        ownBlocks,
        ownBlockRewards
      } = historyItem;
      const rewardPerOwnBlock = ownBlocks === 0 ? undefined : new BigNumber(ownBlockRewards).div(ownBlocks);
      const rewardPerEndorsement = endorsements === 0 ? undefined : new BigNumber(endorsementRewards).div(endorsements);
      const rewardPerFutureBlock = futureBlocks === 0 ? undefined : new BigNumber(futureBlockRewards).div(futureBlocks);
      const rewardPerFutureEndorsement =
        futureEndorsements === 0 ? undefined : new BigNumber(futureEndorsementRewards).div(futureEndorsements);
      return {
        rewardPerOwnBlock,
        rewardPerEndorsement,
        rewardPerFutureBlock,
        rewardPerFutureEndorsement
      };
    });
  }, [bakingHistory]);
  const fallbackRewardsPerEvents = useMemo(() => {
    return [];
    // return rewardsPerEventHistory.map(historyItem =>
    //   allRewardsPerEventKeys.reduce(
    //     (fallbackRewardsItem, key, index) => {
    //       return reduceFunction(fallbackRewardsItem, key, index, historyItem, rewardsPerEventHistory);
    //     },
    //     {
    //       rewardPerOwnBlock: new BigNumber(0),
    //       rewardPerEndorsement: new BigNumber(0),
    //       rewardPerFutureBlock: new BigNumber(0),
    //       rewardPerFutureEndorsement: new BigNumber(0)
    //     }
    //   )
    // );
  }, [rewardsPerEventHistory]);
  const currentCycle = useMemo(
    () =>
      bakingHistory?.find(
        ({ extraBlockRewards, endorsementRewards, ownBlockRewards, ownBlockFees, extraBlockFees }) => {
          const totalCurrentRewards = new BigNumber(extraBlockRewards)
            .plus(endorsementRewards)
            .plus(ownBlockRewards)
            .plus(ownBlockFees)
            .plus(extraBlockFees);
          return totalCurrentRewards.gt(0);
        }
      )?.cycle,
    [bakingHistory]
  );

  const unfamiliarWithDelegation = myBakerPkh === null;

  return {
    canDelegate,
    testGroupName,
    loadingBakingHistory,
    bakingHistory,
    rewardsPerEventHistory,
    fallbackRewardsPerEvents,
    currentCycle,
    unfamiliarWithDelegation
  };
};

// utils ----------------------------

// type RewardsTrueType = {
//   rewardPerOwnBlock: BigNumber;
//   rewardPerEndorsement: BigNumber;
//   rewardPerFutureBlock: BigNumber;
//   rewardPerFutureEndorsement: BigNumber;
// };

// const reduceFunction = (
//   fallbackRewardsItem: RewardsTrueType,
//   key: keyof RewardsPerEventHistoryItem,
//   index: number,
//   historyItem: RewardsPerEventHistoryItem,
//   rewardsPerEventHistory: RewardsPerEventHistoryItem[]
// ) => { ... };
