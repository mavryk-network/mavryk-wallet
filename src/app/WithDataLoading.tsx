import React, { FC } from 'react';

import { useScamlistQuery } from 'lib/assets/use-assets-query';

import { useAssetsLoading } from './hooks/use-assets-loading';
import { useAssetsMigrations } from './hooks/use-assets-migrations';
import { useBalancesLoading } from './hooks/use-balances-loading';
import { useCollectiblesDetailsLoading } from './hooks/use-collectibles-details-loading';
import { useTokensApyLoading } from './hooks/use-load-tokens-apy.hook';
import { useLongRefreshLoading } from './hooks/use-long-refresh-loading.hook';
import { useMetadataLoading } from './hooks/use-metadata-loading';
import { useMetadataRefresh } from './hooks/use-metadata-refresh';
import { useRWAsDetailsLoading } from './hooks/use-rwa-details-loading';
import { useStorageAnalytics } from './hooks/use-storage-analytics';
import { useUserIdSync } from './hooks/use-user-id-sync';

export const WithDataLoading: FC<PropsWithChildren> = ({ children }) => {
  useAssetsMigrations();

  // Scamlist is loaded once on mount via TanStack Query (replaces Redux epic dispatch)
  useScamlistQuery();

  useAssetsLoading();
  useMetadataLoading();
  useMetadataRefresh();
  useBalancesLoading();
  useCollectiblesDetailsLoading();
  useRWAsDetailsLoading();

  useLongRefreshLoading();
  useTokensApyLoading();

  useStorageAnalytics();
  useUserIdSync();

  return <>{children}</>;
};
