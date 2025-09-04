import { AccDelegatePeriodStats } from '../baking';
import { CO_STAKE, FINALIZE_UNLOCK, UNLOCK_STAKE, UNLOCKING } from '../const';

export const getDelegateLabel = (data: AccDelegatePeriodStats) => {
  if (!data) return CO_STAKE;

  if (data.delegationWaitTime === 'allowed' && data.stakedBalance === 0 && data.unlockWaitTime === null) {
    return CO_STAKE;
  }

  if (data.stakedBalance === 0 && data.unlockWaitTime === null) return UNLOCK_STAKE;

  if (data.unlockWaitTime !== 'allowed' && typeof data.unlockWaitTime === 'string') return UNLOCKING;

  if (data.unstakedBalance > 0 && data.unlockWaitTime === 'allowed') return FINALIZE_UNLOCK;

  return UNLOCK_STAKE;
};
