import React, { FC } from 'react';

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
        className="px-2 text-white text-xs leading-3 bg-accent-blue rounded text-center"
        style={{ paddingBlock: 3, marginTop: 1 }}
      >
        {isKYC === undefined ? (
          <Spinner theme="white" className="w-6" />
        ) : isKYC ? (
          <T id="mavopoly" />
        ) : (
          <T id="getPro" />
        )}
      </div>
    </Link>
  );
};
