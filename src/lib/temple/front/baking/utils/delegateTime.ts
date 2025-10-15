import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import { ONE_CYCLE_IN_DAYS } from '../const';

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

// 1) Delegation warm-up (21 days)
export function getDelegationWaitTime(delegationTime?: string | null): string | null {
  if (!delegationTime) return null;

  const start = dayjs(delegationTime);
  const end = start.add(ONE_CYCLE_IN_DAYS * 7, 'day');
  const now = dayjs();

  const diff = end.diff(now);

  return diff > 0 ? formatTimeLeft(diff) : 'allowed';
}

// 2) Unlock stake (12 days)
export function getUnlockWaitTime(lastActivityTime?: string | null, unstakedBalance?: number): string | null {
  // Only compute cooldown if there is actually an unlock in progress
  if (!lastActivityTime || !unstakedBalance || unstakedBalance === 0) return null;

  const start = dayjs(lastActivityTime); // unlock operation time
  const end = start.add(12, 'day');
  const now = dayjs();

  const diff = end.diff(now);

  return diff > 0 ? formatTimeLeft(diff) : 'allowed';
}

// 3) Co-stake lock period (6 days = 2 cycles)
export function getCoStakeWaitTime(
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
  const end = start.add(cyclesLeft * ONE_CYCLE_IN_DAYS, 'day');
  const diff = end.diff(start);

  return formatTimeLeft(diff);
}
