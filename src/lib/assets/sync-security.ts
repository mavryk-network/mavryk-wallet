import { CancelledError } from '@tanstack/react-query';

import { WhitelistResponseToken } from 'lib/apis/temple/whitelist-tokens';
import { buildTokenMetadataFromWhitelist } from 'lib/metadata/utils';
import { requestOwnedUISnapshot, updateOwnedUI } from 'lib/store/zustand/ui-client';
import { UICommand } from 'lib/store/zustand/ui-owner.contract';

import { MAV_TOKEN_SLUG, toTokenSlug } from './utils';

/** Reserve ordering in the owner, across foregrounds and background restarts, before transport starts. */
export async function beginAssetSync(requestKey: string) {
  const request = {
    requestKey,
    requestId: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(
      ''
    )
  };
  await updateOwnedUI({ kind: 'assets-sync-start', ...request });
  return request;
}

/** Await actual owner flush/read-back; obsolete responses never count as a successful synchronization. */
export async function acknowledgeAssetSync(command: UICommand & { requestKey: string; requestId: string }) {
  const snapshot = await requestOwnedUISnapshot(command);
  if (snapshot.assets.syncRequests[command.requestKey] !== command.requestId)
    throw new CancelledError({ revert: true });
}

/** Publish validated security through the same durable authority as user asset choices. */
export async function syncSecurity(
  request: Awaited<ReturnType<typeof beginAssetSync>>,
  response: { kind: 'scamlist'; data: Record<string, boolean> } | { kind: 'whitelist'; data: WhitelistResponseToken[] }
) {
  if (response.kind === 'scamlist') {
    await acknowledgeAssetSync({ kind: 'scamlist-sync', ...request, data: response.data });
  } else {
    const metadata: Extract<UICommand, { kind: 'whitelist-sync' }>['metadata'] = {};
    const data: string[] = [];
    for (const token of response.data) {
      const slug = toTokenSlug(token.contractAddress, token.fa2TokenId);
      if (token.contractAddress !== MAV_TOKEN_SLUG) data.push(slug);
      metadata[slug] = buildTokenMetadataFromWhitelist(token);
    }
    await acknowledgeAssetSync({ kind: 'whitelist-sync', ...request, data, metadata });
  }
}
