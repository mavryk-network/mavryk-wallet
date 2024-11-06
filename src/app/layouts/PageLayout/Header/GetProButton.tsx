import React, { FC } from 'react';

import clsx from 'clsx';

import { Spinner } from 'app/atoms';
import { T } from 'lib/i18n';
import { useAccount } from 'lib/temple/front';
import { Link } from 'lib/woozie';

import { AccountDropdownSelectors } from './selectors';

export const GetProlabel: FC = () => {
  const { isKYC = undefined } = useAccount();

  return (
    <Link to="/pro-version" testID={AccountDropdownSelectors.getProButton}>
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
