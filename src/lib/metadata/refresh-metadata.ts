import { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { ALL_PREDEFINED_METADATAS_RECORD } from 'lib/assets/known-tokens';
import { withScopedWalletRequest } from 'lib/assets/scoped-wallet-request';
import { metadataKeys } from 'lib/query-keys';
import { getOwnedUISnapshot } from 'lib/store/zustand/ui-client';
import { parseData } from 'lib/store/zustand/validation';

import { requestMetadata } from './metadata-query';
import { getMetadataScopeKey, MetadataScope } from './metadata-scope';

const STORAGE_KEY = 'METADATA_REFRESH';
const REFRESH_VERSION = 1;
const recordsSchema = z.record(z.number().int().nonnegative());
interface RefreshLocks {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}
const readRecords = () => parseData(recordsSchema, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));

/** Preserve historical entries; serialize completion across pages and record it only after durable media updates. */
export async function refreshMetadata(client: QueryClient, scope: MetadataScope, signal?: AbortSignal) {
  const locks = (navigator as Navigator & { locks?: RefreshLocks }).locks;
  if (!locks) throw new Error('Metadata refresh coordination unavailable');
  const scopeKey = getMetadataScopeKey(scope);
  return locks.request('temple-metadata-refresh', () =>
    withScopedWalletRequest(scope, signal, async assertScope => {
      if ((readRecords()[scopeKey] ?? 0) >= REFRESH_VERSION) return;
      const metadata = getOwnedUISnapshot().metadata;
      const records = { ...metadata.tokensMetadata, ...metadata.scoped?.[scopeKey]?.tokensMetadata };
      const slugs = Object.keys(records).filter(slug => !ALL_PREDEFINED_METADATAS_RECORD[slug]);
      await requestMetadata(client, scope, 'tokens', slugs, 'refresh', signal);
      // A validated miss preserves cached media but does not claim that the versioned refresh was completed.
      if (slugs.some(slug => client.getQueryData(metadataKeys.receipt('tokens', scope, 'refresh', slug)) !== 'found'))
        throw new Error('Metadata refresh is incomplete');
      await assertScope();
      const completion = { ...readRecords(), [scopeKey]: REFRESH_VERSION };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completion));
      if (readRecords()[scopeKey] !== REFRESH_VERSION) throw new Error('Metadata refresh completion failed');
    })
  );
}
