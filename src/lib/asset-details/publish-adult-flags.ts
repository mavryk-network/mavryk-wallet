import { updateOwnedUI } from 'lib/store/zustand/ui-client';

import { DetailCategory, DetailRecord } from './details.types';

/** Detail cache ownership does not change the durable adult-flag owner or its expiry rules. */
export function publishAdultFlags(category: DetailCategory, details: DetailRecord<{ isAdultContent?: boolean }>) {
  const timestamp = Math.round(Date.now() / 1000);
  const flags: Record<string, { val: boolean; ts: number }> = {};
  for (const [slug, detail] of Object.entries(details)) {
    if (detail) flags[slug] = { val: detail.isAdultContent ?? false, ts: timestamp };
  }
  return updateOwnedUI({ kind: 'adult-flags', category, flags, timestamp });
}
