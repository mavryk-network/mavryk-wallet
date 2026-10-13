import { CancelledError } from '@tanstack/react-query';
import browser from 'webextension-polyfill';

import { ASSET_SCOPE_STORAGE_KEYS } from 'lib/assets/scoped-wallet-request';
import { BALANCE_RECORD_SCHEMA, BalanceScope } from 'lib/store/zustand/balances-state.schema';
import { requestOwnedUISnapshot, updateOwnedUI } from 'lib/store/zustand/ui-client';
import { parseData } from 'lib/store/zustand/validation';

/** Reserve before transport; publication succeeds only after the owner's durable acknowledgement. */
export async function syncBalances(
  scope: BalanceScope,
  load: () => Promise<Record<string, string>>,
  signal?: AbortSignal,
  delta?: { category: 'native' | 'tokens'; level: number; isReorg: boolean }
) {
  const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  let hasChanged = false;
  const handleChange = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && ASSET_SCOPE_STORAGE_KEYS.some(key => key in changes)) hasChanged = true;
  };
  const assertCurrent = () => {
    if (hasChanged || signal?.aborted) throw new CancelledError({ revert: true });
  };
  browser.storage.onChanged.addListener(handleChange);
  try {
    assertCurrent();
    await updateOwnedUI({ kind: 'balances-start', scope, requestId });
    assertCurrent();
    const records = parseData(BALANCE_RECORD_SCHEMA, await load());
    assertCurrent();
    const snapshot = await requestOwnedUISnapshot(
      delta
        ? { kind: 'balances-delta', scope, requestId, records, ...delta }
        : { kind: 'balances-sync', scope, requestId, records }
    );
    assertCurrent();
    if (snapshot.balances.lastReceipt !== requestId) throw new CancelledError({ revert: true });
    return true;
  } finally {
    browser.storage.onChanged.removeListener(handleChange);
    await updateOwnedUI({ kind: 'balances-cancel', requestId });
  }
}
