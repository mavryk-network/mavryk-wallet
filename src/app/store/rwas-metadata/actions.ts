import { createAction } from '@reduxjs/toolkit';

import type { FetchedMetadataRecord } from 'lib/metadata/fetch';

export const putRwasMetadataAction = createAction<{
  records: FetchedMetadataRecord;
  resetLoading?: boolean;
}>('rwas-metadata/PUT_MULTIPLE');

export const loadRwasMetadataAction = createAction<{
  rpcUrl: string;
  slugs: string[];
}>('rwas-metadata/LOAD');

export const resetRwasMetadataLoadingAction = createAction('rwas-metadata/RESET_LOADING');
