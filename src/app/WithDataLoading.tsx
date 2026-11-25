import React, { FC } from 'react';

import { useAssetsLoading } from './hooks/use-assets-loading';
import { useAssetsMigrations } from './hooks/use-assets-migrations';
import { useBalancesLoading } from './hooks/use-balances-loading';
import { useCollectiblesDetailsBatch } from './hooks/use-collectibles-details-loading';
import { useLongRefreshLoading } from './hooks/use-long-refresh-loading.hook';
import { useMetadataLoading } from './hooks/use-metadata-loading';
import { useMetadataRefresh } from './hooks/use-metadata-refresh';
import { useRwasDetailsBatch } from './hooks/use-rwa-details-loading';
import { useStorageAnalytics } from './hooks/use-storage-analytics';
import { useUserIdSync } from './hooks/use-user-id-sync';

export const WithDataLoading: FC<PropsWithChildren> = ({ children }) => {
  useAssetsMigrations();

  useAssetsLoading();
  useMetadataLoading();
  useMetadataRefresh();
  useBalancesLoading();
  useCollectiblesDetailsBatch();
  useRwasDetailsBatch();

  useLongRefreshLoading();

  useStorageAnalytics();
  useUserIdSync();

  return <>{children}</>;
};
