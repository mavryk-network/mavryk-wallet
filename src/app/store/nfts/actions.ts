import { createActions } from 'lib/store';

import type { NFTDetailsRecord } from './state';

export const loadNFTsDetailsActions = createActions<
  string[],
  {
    details: NFTDetailsRecord;
    /** In milliseconds */
    timestamp: number;
  },
  string
>('NFTs/DETAILS');
