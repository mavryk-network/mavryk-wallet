import type { UserHistoryItem } from './types';

/**
 * Reconciles a loaded page into the list by card identity: updated cards replace earlier copies in place,
 * new cards are appended, and pending placeholders retire once a confirmed card with their hash arrives.
 *
 * @returns the merged list and how many cards were new.
 */
export function mergeHistoryPage(previous: UserHistoryItem[], page: UserHistoryItem[]) {
  const confirmedHashes = new Set(page.filter(item => item.status !== 'pending').map(item => item.hash));
  const pageById = new Map(page.map(item => [item.id, item]));
  const kept = previous
    .filter(item => item.status !== 'pending' || !confirmedHashes.has(item.hash) || pageById.has(item.id))
    .map(item => pageById.get(item.id) ?? item);
  const keptIds = new Set(kept.map(item => item.id));
  const added = page.filter(item => !keptIds.has(item.id));

  return { items: [...kept, ...added], addedCount: added.length };
}
