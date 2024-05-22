import { useMemo } from 'react';

import { useAccountRwasSelector } from 'app/store/assets/selectors';
import { useAllAccountBalancesSelector } from 'app/store/balances/selectors';
import { useAccount, useChainId } from 'lib/temple/front';
import { useMemoWithCompare } from 'lib/ui/hooks';

import type { AccountAsset } from '../types';

import { getAssetStatus } from './utils';

export const useAccountRwas = (account: string, chainId: string) => {
  const stored = useAccountRwasSelector(account, chainId);

  const balances = useAllAccountBalancesSelector(account, chainId);

  return useMemoWithCompare<AccountAsset[]>(
    () => {
      const result: AccountAsset[] = [];

      for (const [slug, { status }] of Object.entries(stored)) {
        if (status !== 'removed') result.push({ slug, status: getAssetStatus(balances[slug], status) });
      }

      return result;
    },
    [stored, balances],
    (prev, next) => {
      if (prev.length !== next.length) return false;

      return next.every((item, i) => {
        const prevItem = prev[i]!;
        return item.slug === prevItem.slug && item.status === prevItem.status;
      });
    }
  );
};

export const useEnabledAccountRwaSlugs = () => {
  const chainId = useChainId(true)!;
  const { publicKeyHash } = useAccount();

  const rwas = useAccountRwas(publicKeyHash, chainId);

  return useMemo(
    () => rwas.reduce<string[]>((acc, { slug, status }) => (status === 'enabled' ? acc.concat(slug) : acc), []),
    [rwas]
  );
};
