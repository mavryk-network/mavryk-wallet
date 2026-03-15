import type { TzktApiChainId, TzktOperation } from 'lib/apis/tzkt';
import { GetOperationsTransactionsParams } from 'lib/apis/tzkt/api';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { fetchFromStorage, putToStorage } from 'lib/storage';
import { ReactiveTezosToolkit } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';
import { extractMavrykApiErrorMessage, fetchTokenHistory, fetchWalletHistory } from 'mavryk/api/history';

import { getBackendHistoryFilters, getHistoryItemTypesFromParams } from './filterParams';
import type { UserHistoryItem, OperationsGroup } from './types';
import { HistoryItemOpTypeEnum } from './types';
import {
  buildStorageKeyForTx,
  CustomPendingOperation,
  mavrykHistoryGroupToHistoryItem,
  operationsGroupToHistoryItem
} from './utils';

const MAX_BACKEND_PAGE_SIZE = 20;

export type FetchUserHistoryResult = {
  items: UserHistoryItem[];
  cursor?: number;
  hasMore: boolean;
};

function groupPendingOperations(operations: TzktOperation[]) {
  return Object.values(
    operations.reduce<StringRecord<OperationsGroup>>((acc, item) => {
      if (!acc[item.hash]) {
        acc[item.hash] = { hash: item.hash, operations: [] };
      }

      acc[item.hash].operations.push(item);
      acc[item.hash].operations.sort((a, b) => b.id - a.id);

      return acc;
    }, {})
  );
}

function applyLocalTypeFilter(items: UserHistoryItem[], requestedTypes: HistoryItemOpTypeEnum[]) {
  if (!requestedTypes.length) return items;

  const allowedTypes = new Set(requestedTypes);
  return items.filter(item => allowedTypes.has(item.type));
}

function getTokenAddressFromSlug(assetSlug?: string) {
  if (!assetSlug || assetSlug === MAV_TOKEN_SLUG) return undefined;

  return assetSlug.split('_')[0];
}

async function fetchPendingHistoryItems(chainId: TzktApiChainId, account: TempleAccount) {
  const storageKey = buildStorageKeyForTx(account.publicKeyHash, chainId);
  const pendingOperations = (await fetchFromStorage<CustomPendingOperation[]>(storageKey)) ?? [];

  return {
    storageKey,
    pendingOperations,
    pendingItems: groupPendingOperations(pendingOperations as TzktOperation[]).map(group =>
      operationsGroupToHistoryItem(group, account.publicKeyHash)
    )
  };
}

export async function fetchUserOperationByHash(
  chainId: TzktApiChainId,
  accountAddress: string,
  hash: string,
  assetSlug?: string
) {
  try {
    const tokenAddress = getTokenAddressFromSlug(assetSlug);
    const response = tokenAddress
      ? await fetchTokenHistory(tokenAddress, {
          walletAddress: accountAddress,
          search: hash,
          limit: 20
        })
      : await fetchWalletHistory({
          walletAddress: accountAddress,
          search: hash,
          limit: 20
        });

    return response.operations.map(group =>
      mavrykHistoryGroupToHistoryItem(group, {
        address: accountAddress,
        assetSlug
      })
    );
  } catch (error) {
    console.error('Error while fetching user operation by hash:', error);
    return [];
  }
}

export default async function fetchUserHistory(
  chainId: TzktApiChainId,
  account: TempleAccount,
  assetSlug: string | undefined,
  pseudoLimit: number,
  _tezos: ReactiveTezosToolkit,
  cursor?: number,
  operationParams?: GetOperationsTransactionsParams
): Promise<FetchUserHistoryResult> {
  const requestedTypes = getHistoryItemTypesFromParams(account.publicKeyHash, operationParams);
  const backendFilters = getBackendHistoryFilters(account.publicKeyHash, operationParams);
  const tokenAddress = getTokenAddressFromSlug(assetSlug);
  const isFirstPage = cursor == null;

  try {
    let nextCursor = cursor;
    let hasMore = true;
    const collected: UserHistoryItem[] = [];
    const seenHashes = new Set<string>();

    while (collected.length < pseudoLimit && hasMore) {
      const limit = Math.min(MAX_BACKEND_PAGE_SIZE, pseudoLimit - collected.length);
      const response = tokenAddress
        ? await fetchTokenHistory(tokenAddress, {
            walletAddress: account.publicKeyHash,
            limit,
            cursor: nextCursor,
            filter: backendFilters
          })
        : await fetchWalletHistory({
            walletAddress: account.publicKeyHash,
            limit,
            cursor: nextCursor,
            filter: backendFilters
          });

      const normalizedItems = applyLocalTypeFilter(
        response.operations.map(group =>
          mavrykHistoryGroupToHistoryItem(group, {
            address: account.publicKeyHash,
            assetSlug
          })
        ),
        requestedTypes
      );

      for (const item of normalizedItems) {
        if (!seenHashes.has(item.hash)) {
          seenHashes.add(item.hash);
          collected.push(item);
        }
      }

      if (!response.hasMore || response.cursor == null || response.cursor === nextCursor) {
        hasMore = false;
      } else {
        nextCursor = response.cursor;
        hasMore = true;
      }
    }

    if (!isFirstPage) {
      return {
        items: collected,
        cursor: nextCursor,
        hasMore
      };
    }

    const { storageKey, pendingItems, pendingOperations } = await fetchPendingHistoryItems(chainId, account);
    if (!pendingItems.length) {
      return {
        items: collected,
        cursor: nextCursor,
        hasMore
      };
    }

    const confirmedHashes = new Set(collected.map(item => item.hash));
    const filteredPendingOperations = pendingOperations.filter(
      operation => !confirmedHashes.has(operation?.hash ?? '')
    );

    if (filteredPendingOperations.length !== pendingOperations.length) {
      await putToStorage(storageKey, filteredPendingOperations);
    }

    const filteredPendingItems = applyLocalTypeFilter(
      pendingItems.filter(item => !confirmedHashes.has(item.hash)),
      requestedTypes
    );

    return {
      items: [...filteredPendingItems, ...collected].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
      cursor: nextCursor,
      hasMore
    };
  } catch (error) {
    console.error('Error while fetching user history:', extractMavrykApiErrorMessage(error));

    return {
      items: [],
      cursor,
      hasMore: false
    };
  }
}
