import type { AssetsType } from 'app/store/assets/selectors';

/** Ordering matches the durable destination; alternate API networks sharing a chain must compete. */
export const getAccountAssetsSyncKey = (category: AssetsType, account: string, chainId: string) =>
  `${category}:${account}@${chainId}`;
