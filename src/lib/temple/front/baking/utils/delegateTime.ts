import { ConstantsResponse, UnstakeRequestsResponse } from '@mavrykdynamics/webmavryk-rpc';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import { DEFAULT_BLOCK_DELAY } from '../const';

dayjs.extend(duration);

const UNLOCK_WAIT_CYCLES = 3;

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

function getUnlockWaitDurationMs(cycleDurationMs: number, currentCycle: number, unstakeCycle: number) {
  const unlockCycle = unstakeCycle + UNLOCK_WAIT_CYCLES;
  const cyclesLeft = unlockCycle - currentCycle;

  return cyclesLeft * cycleDurationMs;
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

export function getDelegationWaitTimeFromNow(
  cycleDurationMs: number,
  cyclesToActivate = 7,
  startedAt: string | Date = new Date()
): string {
  const start = dayjs(startedAt);
  const end = start.add(cycleDurationMs * cyclesToActivate, 'millisecond');
  const diff = end.diff(dayjs());
  return formatTimeLeft(diff);
}

// 2) Unlock stake ~ (9 days)
export function getUnlockWaitTime(
  cycleDurationMs: number,
  currentCycle: number,
  unstakeRequests?: UnstakeRequestsResponse | null,
  delegateAddress?: string | null,
  unstakedBalance?: number
): string | null {
  // No unstake in progress
  if (!unstakeRequests || !unstakedBalance || unstakedBalance === 0) return null;

  // If any finalizable request exists for this delegate
  const hasFinalizable =
    Array.isArray(unstakeRequests.finalizable) &&
    unstakeRequests.finalizable.some(item => item.delegate === delegateAddress);

  if (hasFinalizable) return 'allowed';

  // check unfinalizable requests to get period info
  const requests = unstakeRequests.unfinalizable?.requests ?? [];
  if (!requests.length) return null;

  // Use the most recent / maximal cycle among requests
  const unstakeCycle = requests.reduce((max, r) => Math.max(max, Number(r.cycle)), -Infinity);
  if (!isFinite(unstakeCycle) || unstakeCycle < 0) return null;

  const diffMs = getUnlockWaitDurationMs(cycleDurationMs, currentCycle, unstakeCycle);

  // If cycles passed but RPC hasn't yet reported finalizable
  if (diffMs <= 0) return 'pending';

  return formatTimeLeft(diffMs);
}

export function getUnlockWaitDays(cycleDurationMs: number, currentCycle: number, unstakeCycle: number) {
  const diffMs = getUnlockWaitDurationMs(cycleDurationMs, currentCycle, unstakeCycle);

  return Math.max(0, Math.ceil(dayjs.duration(diffMs).asDays()));
}

// 3) Co-stake lock period ~ (6 days = 2 cycles)
export function getCoStakeWaitTime(
  cycleDurationMs: number,
  currentCycle?: number | null,
  delegateCycle?: number | null,
  stakedBalance?: number,
  unstakedBalance?: number
): string | null {
  if (currentCycle == null || delegateCycle == null || (stakedBalance ?? 0) <= 0 || (unstakedBalance ?? 0) > 0) {
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
