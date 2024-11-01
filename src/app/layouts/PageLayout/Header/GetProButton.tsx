import React, { FC } from 'react';

import { VERIFIED_USER_KEY } from 'lib/constants';
import { T } from 'lib/i18n';
import { useLocalStorage } from 'lib/ui/local-storage';
import { Link } from 'lib/woozie';

import { AccountDropdownSelectors } from './selectors';

export const GetProlabel: FC = () => {
  const [isAddressVerified] = useLocalStorage<boolean>(VERIFIED_USER_KEY, false);

  return (
    <Link to="/pro-version" testID={AccountDropdownSelectors.getProButton}>
      <div
        className="px-2 text-white text-xs leading-3 bg-accent-blue rounded text-center"
        style={{ paddingBlock: 3, marginTop: 1 }}
      >
        {isAddressVerified ? <T id="mavopoly" /> : <T id="getPro" />}
      </div>
    </Link>
  );
};
