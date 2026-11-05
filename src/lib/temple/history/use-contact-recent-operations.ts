import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAccount, useAllAccounts, useNetwork } from 'lib/temple/front';
import { getContactsBookScope } from 'lib/temple/front/contacts-settings';
import { MavrykApiError, toMavrykApiError } from 'mavryk/api/errors';
import { fetchRecentOperations } from 'mavryk/api/recent-operations';

import { normalizeRecentOperationsItems } from './fetch';
import type { UserHistoryItem } from './types';
import { usePurchaseMetadata } from './use-purchase-metadata';

/** Poll delay for `preparing`/`stale` snapshots when neither header nor body carries a usable hint. */
const DEFAULT_PREPARING_RETRY_SECONDS = 5;
/** Delay before the single automatic retry of a 429/503 or transport failure without `Retry-After`. */
const DEFAULT_TRANSIENT_RETRY_SECONDS = 30;
/** Retained cards are dropped once their snapshot check time is older than the backend's usable window. */
const MAX_RETAINED_SNAPSHOT_AGE_MS = 10 * 60_000;

export type ContactRecentOperationsStatus =
  /** Contact, address book owner or network not resolved yet: nothing is requested. */
  | 'idle'
  | 'loading'
  | 'preparing'
  | 'ready'
  | 'stale'
  | 'error'
  /** Contract (KT1) contacts have no recent-operations history yet. */
  | 'unsupported';

export type ContactRecentOperationsState = {
  status: ContactRecentOperationsStatus;
  /** Cards of the latest accepted snapshot, in server order; ids are local to that snapshot. */
  items: UserHistoryItem[];
  /** Backend snapshot check time (RFC 3339), never the browser's request time. */
  updatedAt?: string;
  error?: MavrykApiError;
  /** After an error: epoch ms before which the next request (automatic or manual) must not be sent. */
  retryAvailableAt?: number;
};

const IDLE_STATE: ContactRecentOperationsState = { status: 'idle', items: [] };

const isTransientFailure = (error: MavrykApiError) =>
  error.status === undefined || error.status === 429 || error.status === 503;

const isSnapshotUsable = (updatedAt?: string) =>
  Boolean(updatedAt) && Date.now() - Date.parse(updatedAt!) <= MAX_RETAINED_SNAPSHOT_AGE_MS;

/**
 * Up to three recent operation groups of a contact, fetched with the address book owner's session (never as the
 * contact). Follows the backend's `preparing`/`stale` retry hints while mounted, stops on `ready`, retries a
 * transient failure once, and discards late responses after contact, owner or network changes.
 *
 * @param contactAddress Contact address, or undefined while the contact has not resolved.
 */
export function useContactRecentOperations(contactAddress: string | undefined) {
  const account = useAccount();
  const allAccounts = useAllAccounts();
  const { id: networkId } = useNetwork();
  // Token decimals are resolved in the active wallet's metadata scope: the scoped metadata request is cancelled
  // whenever its account differs from the selected wallet, so a contact-scoped lookup could never succeed.
  const resolvePurchaseDecimals = usePurchaseMetadata();

  const bookScope = useMemo(
    () => getContactsBookScope(allAccounts, account.publicKeyHash),
    [allAccounts, account.publicKeyHash]
  );
  const bookAddr = bookScope.status === 'available' ? bookScope.bookAddr : undefined;
  const isUnsupportedAddress = Boolean(contactAddress?.startsWith('KT1'));

  const [state, setState] = useState<ContactRecentOperationsState>(IDLE_STATE);
  const [retryNonce, setRetryNonce] = useState(0);

  // Fetches and follows the contact's recent-operations snapshot for the captured contact/owner/network scope.
  // Manages request timers; cleanup cancels the pending timer and ignores any in-flight response.
  useEffect(() => {
    if (!contactAddress || !bookAddr) {
      setState(IDLE_STATE);
      return;
    }

    if (isUnsupportedAddress) {
      setState({ status: 'unsupported', items: [] });
      return;
    }

    let isCancelled = false;
    let timeoutId: number | undefined;
    let hasRetriedTransientFailure = false;
    const authContext = { walletAddress: bookAddr, networkId };

    const schedule = (seconds: number, task: () => void = load) => {
      timeoutId = window.setTimeout(task, seconds * 1000);
    };

    async function load() {
      try {
        const result = await fetchRecentOperations(contactAddress!, authContext);
        if (isCancelled) return;

        const items = await normalizeRecentOperationsItems(result.operations, contactAddress!, resolvePurchaseDecimals);
        if (isCancelled) return;

        hasRetriedTransientFailure = false;
        // Every accepted response replaces the previous snapshot; `preparing` always arrives with no cards.
        setState({ status: result.status, items, updatedAt: result.updatedAt });

        if (result.status !== 'ready') {
          schedule(result.retryAfterSeconds || DEFAULT_PREPARING_RETRY_SECONDS);
        }
      } catch (rawError) {
        if (isCancelled) return;

        const error = toMavrykApiError(rawError);
        if (error.isCancelled) return;

        if (error.code === 'unsupported_address') {
          setState({ status: 'unsupported', items: [] });
          return;
        }

        console.error('Unable to load contact recent operations', error.status ?? error.message);
        const shouldAutoRetry = isTransientFailure(error) && !hasRetriedTransientFailure;
        const retryAfterSeconds =
          error.retryAfterSeconds ?? (isTransientFailure(error) ? DEFAULT_TRANSIENT_RETRY_SECONDS : 0);
        const retryAvailableAt = Date.now() + retryAfterSeconds * 1000;
        // Same-scope cards may stay visible as outdated while their snapshot is still within the usable window.
        setState(prev => {
          const keepPrevious = prev.items.length > 0 && isSnapshotUsable(prev.updatedAt);
          return {
            status: 'error',
            items: keepPrevious ? prev.items : [],
            updatedAt: keepPrevious ? prev.updatedAt : undefined,
            error,
            retryAvailableAt
          };
        });

        if (shouldAutoRetry) {
          hasRetriedTransientFailure = true;
          // Leaving the error state while the automatic retry runs keeps a manual retry from doubling it.
          schedule(retryAfterSeconds, () => {
            setState(prev => ({ ...prev, status: 'loading', error: undefined, retryAvailableAt: undefined }));
            load();
          });
        }
      }
    }

    setState({ status: 'loading', items: [] });
    load();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [contactAddress, bookAddr, networkId, isUnsupportedAddress, resolvePurchaseDecimals, retryNonce]);

  const { status, retryAvailableAt } = state;
  /** Manual retry after an error; ignored while a `Retry-After` cooldown is active. */
  const retry = useCallback(() => {
    if (status !== 'error' || (retryAvailableAt !== undefined && Date.now() < retryAvailableAt)) return;
    setRetryNonce(nonce => nonce + 1);
  }, [status, retryAvailableAt]);

  return { ...state, retry };
}
