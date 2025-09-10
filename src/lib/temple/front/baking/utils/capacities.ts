type DelegateData = {
  stakedBalance: number;
  totalStakedBalance: number;
  delegatedBalance: number;
};
export function calculateCapacities(data?: DelegateData) {
  const { stakedBalance = 0, delegatedBalance = 0 } = data ?? {};

  // personal stake * 5
  const costakingCapacity = stakedBalance * 5;

  // costaking capacity * 9
  const delegationCapacity = costakingCapacity * 9;

  // Optional % used
  const costakingUsedPercent = costakingCapacity > 0 ? (delegatedBalance / costakingCapacity) * 100 : 0;

  const delegationUsedPercent = delegationCapacity > 0 ? (delegatedBalance / delegationCapacity) * 100 : 0;

  return {
    costakingCapacity,
    delegationCapacity,
    costakingUsedPercent,
    delegationUsedPercent,
    totalCapacity: costakingCapacity + delegationCapacity
  };
}
