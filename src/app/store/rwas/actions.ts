import { createActions } from 'lib/store';

import type { RwaDetailsRecord } from './state';

export const loadRwasDetailsActions = createActions<
  string[],
  {
    details: RwaDetailsRecord;
    /** In milliseconds */
    timestamp: number;
  },
  string
>('rwas/DETAILS');
