import { ConstantsResponse } from '@mavrykdynamics/taquito-rpc';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import { DEFAULT_BLOCK_DELAY } from '../const';

dayjs.extend(duration);

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'allowed';

  const d = dayjs.duration(ms);
  const days = d.days();
  const hours = d.hours();
  const minutes = d.minutes();
  const seconds = d.seconds();

  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function getOneCycleinMs(constants: ConstantsResponse) {
  const { blocks_per_cycle, minimal_block_delay = DEFAULT_BLOCK_DELAY } = constants;

  const blocksPerCycle = new BigNumber(blocks_per_cycle);
  const minimalBlockDelay = new BigNumber(minimal_block_delay);
  const cycleDurationMs = blocksPerCycle.multipliedBy(minimalBlockDelay).multipliedBy(1000).toNumber();

  return cycleDurationMs;
}

// 1) Delegation warm-up ~ (21 days)
export function getDelegationWaitTime(cycleDurationMs: number, delegationTime?: string | null): string | null {
  if (!delegationTime) return null;

  const start = dayjs(delegationTime);
  const end = start.add(cycleDurationMs * 7, 'millisecond');
  const now = dayjs();

  const diff = end.diff(now);

  return diff > 0 ? formatTimeLeft(diff) : 'allowed';
}

// 2) Unlock stake ~ (9 days)
export function getUnlockWaitTime(
  cycleDurationMs: number,
  isFinalizableUnstakeRequest: boolean,
  lastActivityTime?: string | null,
  unstakedBalance?: number
): string | null {
  // Only compute cooldown if there is actually an unlock in progress
  if (!lastActivityTime || !unstakedBalance || unstakedBalance === 0) return null;

  if (isFinalizableUnstakeRequest) return 'allowed';

  const start = dayjs(lastActivityTime); // unlock operation time

  // For Tezos, unlock stake usually requires ~3 cycles
  const end = start.add(cycleDurationMs * 3, 'millisecond'); // 3 cycles

  const now = dayjs();
  const diff = end.diff(now);

  // case when unlock period time has passed but isFinalizableUnstakeRequest is not yet true
  if (diff <= 0 && !isFinalizableUnstakeRequest) {
    return 'pending';
  }

  return diff > 0 ? formatTimeLeft(diff) : 'allowed';
}

// 3) Co-stake lock period ~ (6 days = 2 cycles)
export function getCoStakeWaitTime(
  cycleDurationMs: number,
  currentCycle?: number | null,
  delegateCycle?: number | null,
  lastActivityTime?: string | null,
  stakedBalance?: number,
  unstakedBalance?: number
): string | null {
  if (
    currentCycle == null ||
    delegateCycle == null ||
    !lastActivityTime ||
    (stakedBalance ?? 0) <= 0 ||
    (unstakedBalance ?? 0) > 0
  ) {
    return null;
  }

  const cyclesLeft = delegateCycle - currentCycle;

  // already reached or passed required cycle
  if (cyclesLeft <= 0) return 'allowed';

  const start = dayjs();
  const end = start.add(cyclesLeft * cycleDurationMs, 'millisecond');
  const diff = end.diff(start);

  return formatTimeLeft(diff);
}
