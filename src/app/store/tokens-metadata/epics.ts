import { combineEpics, Epic } from 'redux-observable';
import { EMPTY } from 'rxjs';

/**
 * The whitelist-to-metadata bridge epic has been removed.
 * Whitelist data is now fed directly to the Zustand metadata store
 * from the TanStack Query hook in `lib/assets/use-assets-query.ts`.
 *
 * This file is kept as a no-op epic to avoid breaking the root epic combiner.
 */
const noopEpic: Epic = () => EMPTY;

export const tokensMetadataEpics = combineEpics(noopEpic);
