import React, { FC } from 'react';

import clsx from 'clsx';

import { Spinner } from 'app/atoms';
import { T } from 'lib/i18n';
import { useAccount, useNetwork } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { Link } from 'lib/woozie';

import { AccountDropdownSelectors } from './selectors';

export const GetProlabel: FC = () => {
  const { isKYC = undefined, type } = useAccount();
  const net = useNetwork();

  const disabled = type === TempleAccountType.WatchOnly || net.id === 'mainnet';

  return (
    <Link
      className={clsx(disabled && 'opacity-50 pointer-events-none cursor-not-allowed')}
      to={disabled ? '#' : '/pro-version'}
      testID={AccountDropdownSelectors.getProButton}
    >
      <div
        className={clsx(
          'px-2 text-white text-xs leading-3 rounded text-center',
          !isKYC ? 'bg-accent-blue' : 'border border-accent-blue'
        )}
        style={{ paddingBlock: 3, marginTop: 1 }}
      >
        {isKYC === undefined ? (
          <Spinner theme="white" className="w-6" />
        ) : isKYC ? (
          <T id="mavrykPro" />
        ) : (
          <T id="getPro" />
        )}
      </div>
    </Link>
  );
};
