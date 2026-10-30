import type { TzktApiChainId, TzktOperation } from 'lib/apis/tzkt';
import { GetOperationsTransactionsParams } from 'lib/apis/tzkt/api';
import { MAV_TOKEN_SLUG, toTokenSlug } from 'lib/assets';
import { fetchFromStorage, putToStorage } from 'lib/storage';
import { ReactiveTezosToolkit } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';
import { fetchTokenHistory, fetchWalletHistory } from 'mavryk/api/history';
import type { MavrykEquiteezHistoryStatus, MavrykHistoryOperation } from 'mavryk/api/history';

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

async function normalizeBackendHistoryItems(
  operations: ReturnType<typeof groupMavrykHistoryOperations>[number]['operations'],
  accountAddress: string,
  requestedTypes: HistoryItemOpTypeEnum[],
  assetSlug?: string,
  resolveDecimals?: PurchaseDecimalsResolver
) {
  const groups = groupMavrykHistoryOperations(operations, { preserveTopLevelGroups: true });
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
  return applyLocalTypeFilter(
    groups.map(group =>
      mavrykHistoryGroupToHistoryItem(group, {
        address: accountAddress,
        assetSlug,
        decimals
      })
    ),
    requestedTypes
  );
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
  tokenAddress = getTokenAddressFromSlug(assetSlug)
) {
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
  tokenAddress = getTokenAddressFromSlug(assetSlug)
): Promise<FetchUserHistoryResult> {
  const requestedTypes = getHistoryItemTypesFromParams(account.publicKeyHash, operationParams);
  const backendFilter = getBackendHistoryFilters(account.publicKeyHash, operationParams);
  const localRequestedTypes = shouldApplyLocalTypeFilter(operationParams) ? requestedTypes : [];
  const isFirstPage = cursor == null;

  const response = tokenAddress
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

  if (!isFirstPage) {
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
