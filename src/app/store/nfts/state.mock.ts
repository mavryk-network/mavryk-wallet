import { createEntity, mockPersistedState } from 'lib/store';

import type { NFTsState } from './state';

export const mockNFTsState = mockPersistedState<NFTsState>({
  details: createEntity({}),
  adultFlags: {}
});
