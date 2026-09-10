/** Shared persisted account/chain key; keep compatible with existing Redux asset records. */
export const getAccountAssetsStoreKey = (account: string, chainId: string) => `${account}@${chainId}`;
