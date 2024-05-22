import { createEntity, mockPersistedState } from 'lib/store';

import { SliceState } from './state';

export const mockAssetsState = mockPersistedState<SliceState>({
  tokens: createEntity({}),
  rwas: createEntity({}),
  collectibles: createEntity({}),
  mainnetWhitelist: createEntity([]),
  mainnetScamlist: createEntity({})
});
