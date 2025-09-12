import React, { FC, useMemo } from 'react';

import clsx from 'clsx';

import { ReactComponent as SmallClockIcon } from 'app/icons/small-clock.svg';
import { T, TID } from 'lib/i18n';
import { useAccount } from 'lib/temple/front';
import { useAccountDelegatePeriodStats } from 'lib/temple/front/baking';

export const AddBanner: FC<{ text: TID }> = ({ text }) => (
  <div className={'font-normal text-xs px-2 py-1 bg-indigo-add text-white ml-2 rounded'}>
    <T id={text} />
  </div>
);

export const DelegatePeriodBanner = () => {
  const account = useAccount();
  const { isInDelegationPeriod, isInUnlockPeriod, hasUnlockPeriodPassed, unlockWaitTime, delegationWaitTime } =
    useAccountDelegatePeriodStats(account.publicKeyHash);

  const labelInfo = useMemo(() => {
    if (isInUnlockPeriod) {
      return {
        text: (
          <div className="flex items-center">
            <T id="unlockingPeriod" substitutions={[<SmallClockIcon />, unlockWaitTime]} />
          </div>
        ),
        color: 'bg-orange-add'
      };
    }
    if (isInDelegationPeriod) {
      return {
        text: (
          <div className="flex items-center">
            <T id="delegatingPeriod" substitutions={[<SmallClockIcon />, delegationWaitTime]} />
          </div>
        ),
        color: 'bg-orange-add'
      };
    }

    if (hasUnlockPeriodPassed) {
      return {
        text: <T id="unlocked" />,
        color: 'bg-green-add'
      };
    }

    return {
      text: <T id="delegated" />,
      color: 'bg-indigo-add'
    };
  }, [hasUnlockPeriodPassed, isInDelegationPeriod, isInUnlockPeriod, unlockWaitTime, delegationWaitTime]);
  return (
    <div
      style={{ paddingBottom: 2, lineHeight: '18px' }}
      className={clsx('font-normal text-xs px-2 text-white ml-2 rounded capitalize', labelInfo.color)}
    >
      {labelInfo.text}
    </div>
  );
};
