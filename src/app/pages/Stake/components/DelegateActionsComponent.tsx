import React, { FC, useCallback, useMemo, useState } from 'react';

import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { T } from 'lib/i18n';
import { MAVEN_METADATA } from 'lib/metadata';
import { useAccount, useChainId, useTezos } from 'lib/temple/front';
import { useAccountDelegatePeriodStats } from 'lib/temple/front/baking';
import { CO_STAKE, FINALIZE_UNLOCK, MANAGE_STAKE, UNLOCK_STAKE, UNLOCKING } from 'lib/temple/front/baking/const';
import { getDelegateLabel } from 'lib/temple/front/baking/utils/label';
import { atomsToTokens } from 'lib/temple/helpers';
import { buildPendingOperationObject, putOperationIntoStorage } from 'lib/temple/history/utils';
import { TempleAccountType } from 'lib/temple/types';
import { navigate } from 'lib/woozie';

import { RedelegatePopup } from '../popups/Redelegate.popup';
import { UnlockPopup } from '../popups/Unlock.popup';
import { UnlockFisrtPopup } from '../popups/UnlockFirst.popup';

export const DelegateActionsComponent: FC<{ avtivateReDelegation: () => void }> = ({ avtivateReDelegation }) => {
  const [opened, setOpened] = useState({
    redelegate: false,
    unlock: false,
    firstUnlock: false
  });
  const account = useAccount();
  const chainId = useChainId();
  const tezos = useTezos();
  const { data } = useAccountDelegatePeriodStats(account.publicKeyHash);
  const { canRedelegate, canCostake, canUnlock, stakedBalance = 0, unstakedBalance = 0, myBakerPkh } = data ?? {};
  const delegateLabel = getDelegateLabel(data);
  const hasZeroStakingBalance = stakedBalance === 0 && unstakedBalance === 0;

  const isWatchOnlyAccount = account.type === TempleAccountType.WatchOnly;

  const close = useCallback((key: keyof typeof opened) => {
    setOpened(prev => ({ ...prev, [key]: false }));
  }, []);

  const open = useCallback((key: keyof typeof opened) => {
    setOpened(prev => ({ ...prev, [key]: true }));
  }, []);

  const handleReDelegateNavigation = useCallback(() => {
    avtivateReDelegation();
    close('redelegate');
  }, [avtivateReDelegation, close]);

  const handleDelegateClickbasedOnPeriod = useCallback(async () => {
    if (hasZeroStakingBalance && delegateLabel === CO_STAKE) {
      return navigate('/co-stake');
    }

    if (delegateLabel === CO_STAKE) {
      return navigate('/manage-stake?tab=stake');
    } else if (delegateLabel === UNLOCK_STAKE) {
      return navigate('/manage-stake?tab=stake');
    }

    if (delegateLabel === FINALIZE_UNLOCK) {
      try {
        const estmtn = await tezos.estimate.finalizeUnstake({});
        const op = await tezos.wallet.finalizeUnstake({}).send();

        // create pending delegate operation
        const pendingOpObject = await buildPendingOperationObject({
          operation: op,
          type: 'staking',
          sender: account.publicKeyHash,
          estimation: estmtn,
          baker: myBakerPkh,
          kind: 'finalize_unstake'
        });
        if (pendingOpObject) await putOperationIntoStorage(chainId, account.publicKeyHash, pendingOpObject);

        return navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'finalizeUnlock',
          btnText: 'viewHistoryTab',
          btnLink: '?tab=history',
          contentId: 'DelegationOperation',
          contentIdFnProps: {
            hash: pendingOpObject?.hash,
            assetSlug: MAV_TOKEN_SLUG,
            amount: atomsToTokens(unstakedBalance ?? 0, MAVEN_METADATA.decimals).toNumber(),
            validatorAddress: myBakerPkh,
            type: 'finalize'
          }
        });
      } catch (error) {
        console.error(error);
      }
    }

    if (delegateLabel === UNLOCKING) {
      return;
    }
  }, [
    account.publicKeyHash,
    chainId,
    delegateLabel,
    hasZeroStakingBalance,
    myBakerPkh,
    tezos.estimate,
    tezos.wallet,
    unstakedBalance
  ]);

  const isStakeButtonDisabled = useMemo(() => {
    switch (delegateLabel) {
      case CO_STAKE:
        return !canCostake;
      case UNLOCK_STAKE:
        return !canUnlock;
      case UNLOCKING:
        return true;
      case FINALIZE_UNLOCK:
        return false;
      default:
        return false;
    }
  }, [canCostake, canUnlock, delegateLabel]);

  const handleRedelegateClick = useCallback(() => {
    if (!canRedelegate) return;
    if (delegateLabel === UNLOCK_STAKE) {
      open('firstUnlock');
    } else {
      open('redelegate');
    }
  }, [delegateLabel, open, canRedelegate]);

  const delegationLabelToShow = useMemo(() => {
    return (delegateLabel === CO_STAKE || delegateLabel === UNLOCK_STAKE) && !hasZeroStakingBalance
      ? MANAGE_STAKE
      : delegateLabel;
  }, [delegateLabel, hasZeroStakingBalance]);

  if (isWatchOnlyAccount) return null;

  return (
    <div className="grid gap-3 grid-cols-2">
      <ButtonRounded
        size="xs"
        fill={false}
        onClick={handleRedelegateClick}
        disabled={isWatchOnlyAccount || !canRedelegate}
      >
        <T id="reDelegate" />
      </ButtonRounded>
      <ButtonRounded
        size="xs"
        fill
        onClick={handleDelegateClickbasedOnPeriod}
        disabled={isWatchOnlyAccount || isStakeButtonDisabled}
      >
        {delegationLabelToShow}
      </ButtonRounded>

      <RedelegatePopup
        opened={opened.redelegate}
        close={close.bind(null, 'redelegate')}
        handleReDelegateNavigation={handleReDelegateNavigation}
      />
      <UnlockPopup opened={opened.unlock} close={close.bind(null, 'unlock')} />
      <UnlockFisrtPopup opened={opened.firstUnlock} close={close.bind(null, 'firstUnlock')} />
    </div>
  );
};
