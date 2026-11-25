type DelegateData = {
  stakedBalance: number;
  delegatedBalance: number;
  externalStakedBalance: number;
};
export function calculateCapacities(data?: DelegateData) {
  const { stakedBalance = 0, delegatedBalance = 0, externalStakedBalance = 0 } = data ?? {};

  // personal stake * 5
  const costakingCapacity = stakedBalance * 5;

  // costaking capacity * 9
  const delegationCapacity = stakedBalance * 9;

  // Optional % used
  const costakingUsedPercent = costakingCapacity > 0 ? (externalStakedBalance / costakingCapacity) * 100 : 0;

  const delegationUsedPercent = delegationCapacity > 0 ? (delegatedBalance / delegationCapacity) * 100 : 0;

  const totalCapacity = costakingCapacity + delegationCapacity;

  return {
    costakingCapacity,
    delegationCapacity,
    costakingUsedPercent,
    delegationUsedPercent,
    totalCapacity,
    totalFreSpace: totalCapacity - delegatedBalance - stakedBalance,
    delegatedFreeSpace: delegationCapacity - delegatedBalance, // -54m || - 13m
    costakedFreeSpace: costakingCapacity - stakedBalance
  };
}
