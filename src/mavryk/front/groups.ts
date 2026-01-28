import { useMemo } from 'react';

import { useHDGroups } from 'lib/temple/front/ready';
import { TempleAccount } from 'lib/temple/types';

import { getAllGroups } from './accounts-groups';

export const useAccountsGroups = (accounts: TempleAccount[]) => {
  const hdGroups = useHDGroups();

  return useMemo(() => getAllGroups(hdGroups, accounts), [hdGroups, accounts]);
};
