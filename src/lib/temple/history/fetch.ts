import type { TzktApiChainId, TzktOperation } from 'lib/apis/tzkt';
import { GetOperationsTransactionsParams } from 'lib/apis/tzkt/api';
import { MAV_TOKEN_SLUG, toTokenSlug } from 'lib/assets';
import { fetchFromStorage, putToStorage } from 'lib/storage';
import { ReactiveTezosToolkit } from 'lib/temple/front';
import { TempleAccount, TempleAccountType } from 'lib/temple/types';
import { MavrykApiError } from 'mavryk/api/errors';
import { fetchTokenHistory, fetchWalletHistory, fetchWatchOnlyWalletHistory } from 'mavryk/api/history';
import type { MavrykEquiteezHistoryStatus, MavrykHistoryOperation } from 'mavryk/api/history';
import { getSelectedNetworkIdFromStorage } from 'mavryk/api/storage';

import { hasHistoryMovement } from './bridge';
import { MVRK_HISTORY_TOKEN_ADDRESS } from './consts';
import { getBackendHistoryFilters, getHistoryItemTypesFromParams, shouldApplyLocalTypeFilter } from './filterParams';
import { getPurchaseMovements } from './purchase';
import type { UserHistoryItem, OperationsGroup } from './types';
import { HistoryItemOpTypeEnum } from './types';
import {
  buildStorageKeyForTx,
  CustomPendingOperation,
  groupMavrykHistoryOperations,
  mavrykHistoryGroupToHistoryItem,
  operationsGroupToHistoryItem
} from './utils';

type PurchaseDecimalsResolver = (slugs: string[]) => Promise<Record<string, number>>;

export type FetchUserHistoryResult = {
  items: UserHistoryItem[];
  cursor?: number;
  hasMore: boolean;
  /** Equiteez enrichment status of this page; undefined on the legacy response path. */
  equiteezStatus?: MavrykEquiteezHistoryStatus;
};

type PendingOperationGroupable = {
  hash: string;
  id?: number;
};

type LegacyPendingOperation = TzktOperation;

function groupPendingOperations<T extends PendingOperationGroupable>(operations: T[]) {
  return Object.values(
    operations.reduce<StringRecord<{ hash: string; operations: T[] }>>((acc, item) => {
      if (!acc[item.hash]) {
        acc[item.hash] = { hash: item.hash, operations: [] };
      }

      acc[item.hash].operations.push(item);
      acc[item.hash].operations.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

      return acc;
    }, {})
  );
}

function isLegacyPendingOperation(
  operation: CustomPendingOperation | LegacyPendingOperation
): operation is LegacyPendingOperation {
  return typeof (operation as LegacyPendingOperation).sender !== 'string';
}

function applyLocalTypeFilter(items: UserHistoryItem[], requestedTypes: HistoryItemOpTypeEnum[]) {
  if (!requestedTypes.length) return items;

  const allowedTypes = new Set(requestedTypes);
  return items.filter(item => allowedTypes.has(item.type));
}

function getTokenAddressFromSlug(assetSlug?: string) {
  if (!assetSlug) return undefined;
  if (assetSlug === MAV_TOKEN_SLUG) return MVRK_HISTORY_TOKEN_ADDRESS;

  return assetSlug.split('_')[0];
}

/** Error code for a per-asset history request from a Watch only account, which has no public route. */
export const WATCH_ONLY_ASSET_HISTORY_UNSUPPORTED = 'watch_only_asset_history_unsupported';

/** Full operation hash accepted by Watch only history search (51-character base58, `oo`/`op` prefix). */
const FULL_OPERATION_HASH_REGEX = /^o[op][1-9A-HJ-NP-Za-km-z]{49}$/;

export const isFullOperationHash = (value: string) => FULL_OPERATION_HASH_REGEX.test(value);

export const isWatchOnlyAccount = (account: Pick<TempleAccount, 'type'>) =>
  account.type === TempleAccountType.WatchOnly;

function throwWatchOnlyAssetHistoryUnsupported(): never {
  throw new MavrykApiError('Asset history is not available for watch-only accounts', {
    code: WATCH_ONLY_ASSET_HISTORY_UNSUPPORTED
  });
}

async function historyGroupsToItems(
  groups: ReturnType<typeof groupMavrykHistoryOperations>,
  accountAddress: string,
  assetSlug?: string,
  resolveDecimals?: PurchaseDecimalsResolver
) {
  const rawAmountSlugs = groups.flatMap(group =>
    [group.summaryOperation, ...group.operations].flatMap(operation => {
      const details = operation?.details;
      if (details?.amount != null || details?.rawAmount === undefined) return [];
      return details.tokenAddress
        ? [toTokenSlug(details.tokenAddress, details.tokenId ?? 0)]
        : assetSlug
        ? [assetSlug]
        : [];
    })
  );
  const slugs = [
    ...new Set([
      ...rawAmountSlugs,
      ...groups
        .filter(
          group =>
            group.summaryOperation?.details?.entrypoint === 'purchase' ||
            hasHistoryMovement((group.summaryOperation ?? group.operations[0])?.details)
        )
        .flatMap(group => getPurchaseMovements(group.operations))
        .filter(movement => movement.to === accountAddress || movement.from === accountAddress)
        .map(movement => movement.assetSlug)
    ])
  ];
  const decimals = slugs.length && resolveDecimals ? await resolveDecimals(slugs) : {};
  return groups.map(group =>
    mavrykHistoryGroupToHistoryItem(group, {
      address: accountAddress,
      assetSlug,
      decimals
    })
  );
}

async function normalizeBackendHistoryItems(
  operations: ReturnType<typeof groupMavrykHistoryOperations>[number]['operations'],
  accountAddress: string,
  requestedTypes: HistoryItemOpTypeEnum[],
  assetSlug?: string,
  resolveDecimals?: PurchaseDecimalsResolver
) {
  const groups = groupMavrykHistoryOperations(operations, { preserveTopLevelGroups: true });

  return applyLocalTypeFilter(
    await historyGroupsToItems(groups, accountAddress, assetSlug, resolveDecimals),
    requestedTypes
  );
}

/**
 * Adapts a recent-operations snapshot from `perspectiveAddress`'s point of view. Each returned group stays its
 * own card in server order (no cross-card hash grouping, no pending merge); ids are prefixed with the ordinal
 * so same-hash cards keep distinct identities within the snapshot.
 */
export async function normalizeRecentOperationsItems(
  operations: MavrykHistoryOperation[],
  perspectiveAddress: string,
  resolveDecimals?: PurchaseDecimalsResolver
) {
  const groups = operations.flatMap(operation =>
    groupMavrykHistoryOperations([operation], { preserveTopLevelGroups: true }).slice(0, 1)
  );
  const items = await historyGroupsToItems(groups, perspectiveAddress, undefined, resolveDecimals);

  return items.map((item, index) => ({ ...item, id: `${index}:${item.id}` }));
}

async function fetchPendingHistoryItems(chainId: TzktApiChainId, account: TempleAccount) {
  const storageKey = buildStorageKeyForTx(account.publicKeyHash, chainId);
  const pendingOperations =
    (await fetchFromStorage<(CustomPendingOperation | LegacyPendingOperation)[]>(storageKey)) ?? [];
  const legacyPendingOperations = pendingOperations.filter(isLegacyPendingOperation);
  const backendPendingOperations = pendingOperations.filter(
    (operation): operation is MavrykHistoryOperation => !isLegacyPendingOperation(operation)
  );
  const pendingItems = [
    ...groupPendingOperations(backendPendingOperations).flatMap(group => {
      const historyGroup = groupMavrykHistoryOperations(group.operations)[0];

      return historyGroup ? [mavrykHistoryGroupToHistoryItem(historyGroup, { address: account.publicKeyHash })] : [];
    }),
    ...groupPendingOperations(legacyPendingOperations).map(group => {
      const operationsGroup: OperationsGroup = {
        hash: group.hash,
        operations: group.operations
      };

      return operationsGroupToHistoryItem(operationsGroup, account.publicKeyHash);
    })
  ].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  return {
    storageKey,
    pendingOperations,
    pendingItems
  };
}

export async function fetchUserOperationByHash(
  _chainId: TzktApiChainId,
  accountAddress: string,
  hash: string,
  assetSlug?: string,
  resolveDecimals?: PurchaseDecimalsResolver,
  tokenAddress = getTokenAddressFromSlug(assetSlug),
  watchOnlyNetworkId?: string
) {
  if (watchOnlyNetworkId !== undefined) {
    if (tokenAddress) throwWatchOnlyAssetHistoryUnsupported();

    const watchOnlyResponse = await fetchWatchOnlyWalletHistory(accountAddress, watchOnlyNetworkId, { search: hash });

    return normalizeBackendHistoryItems(watchOnlyResponse.operations, accountAddress, [], undefined, resolveDecimals);
  }

  const response = tokenAddress
    ? await fetchTokenHistory(tokenAddress, {
        walletAddress: accountAddress,
        tokenId: assetSlug?.split('_')[1],
        search: hash
      })
    : await fetchWalletHistory({
        walletAddress: accountAddress,
        search: hash
      });

  return normalizeBackendHistoryItems(response.operations, accountAddress, [], assetSlug, resolveDecimals);
}

export default async function fetchUserHistory(
  chainId: TzktApiChainId,
  account: TempleAccount,
  assetSlug: string | undefined,
  _pseudoLimit: number,
  _tezos: ReactiveTezosToolkit,
  cursor?: number,
  operationParams?: GetOperationsTransactionsParams,
  resolveDecimals?: PurchaseDecimalsResolver,
  tokenAddress = getTokenAddressFromSlug(assetSlug),
  networkId?: string
): Promise<FetchUserHistoryResult> {
  const isWatchOnly = isWatchOnlyAccount(account);
  if (isWatchOnly && tokenAddress) throwWatchOnlyAssetHistoryUnsupported();

  const requestedTypes = getHistoryItemTypesFromParams(account.publicKeyHash, operationParams);
  const backendFilter = getBackendHistoryFilters(account.publicKeyHash, operationParams);
  const localRequestedTypes = shouldApplyLocalTypeFilter(operationParams) ? requestedTypes : [];
  const isFirstPage = cursor == null;

  const response = isWatchOnly
    ? await fetchWatchOnlyWalletHistory(account.publicKeyHash, networkId ?? (await getSelectedNetworkIdFromStorage()), {
        cursor,
        filter: backendFilter
      })
    : tokenAddress
    ? await fetchTokenHistory(tokenAddress, {
        walletAddress: account.publicKeyHash,
        cursor,
        tokenId: assetSlug?.split('_')[1],
        filter: backendFilter
      })
    : await fetchWalletHistory({
        walletAddress: account.publicKeyHash,
        cursor,
        filter: backendFilter
      });
  const hasMore = response.hasMore;
  const nextCursor = response.cursor ?? undefined;

  if (hasMore && (nextCursor === undefined || nextCursor === cursor)) {
    throw new Error('History response has more pages but no advancing cursor');
  }

  // The whole page is kept: groups sharing a boundary may exceed the requested limit, and the cursor already
  // points past all of them, so trimming here would lose rows permanently.
  const collected = await normalizeBackendHistoryItems(
    response.operations,
    account.publicKeyHash,
    localRequestedTypes,
    assetSlug,
    resolveDecimals
  );
  const pageResult = { cursor: nextCursor, hasMore, equiteezStatus: response.equiteezHistory?.status };

  // Watch only accounts never submit local transactions, so they have no pending operations to merge.
  if (!isFirstPage || isWatchOnly) {
    return { items: collected, ...pageResult };
  }

  const { storageKey, pendingItems, pendingOperations } = await fetchPendingHistoryItems(chainId, account);
  if (!pendingItems.length) {
    return { items: collected, ...pageResult };
  }

  // A confirmed hash retires its pending placeholder; every confirmed group under that hash stays.
  const confirmedHashes = new Set(collected.map(item => item.hash));
  const filteredPendingOperations = pendingOperations.filter(operation => !confirmedHashes.has(operation?.hash ?? ''));

  if (filteredPendingOperations.length !== pendingOperations.length) {
    await putToStorage(storageKey, filteredPendingOperations);
  }

  const filteredPendingItems = applyLocalTypeFilter(
    pendingItems.filter(item => !confirmedHashes.has(item.hash)),
    requestedTypes
  );

  return {
    items: [...filteredPendingItems, ...collected].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    ...pageResult
  };
}
