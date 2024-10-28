import React, { FC } from 'react';

import { T } from 'lib/i18n';
import { Link } from 'lib/woozie';

import { AccountDropdownSelectors } from './selectors';

export const GetProlabel: FC = () => {
  return (
    <Link to="/pro-version" testID={AccountDropdownSelectors.getProButton}>
      <div
        className="px-2 text-white text-xs leading-3 bg-accent-blue rounded text-center"
        style={{ paddingBlock: 3, marginTop: 1 }}
      >
        <T id="getPro" />
      </div>
    </Link>
  );
};
