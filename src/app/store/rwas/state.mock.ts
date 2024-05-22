import { createEntity, mockPersistedState } from 'lib/store';

import type { RwasState } from './state';

export const mockRwasState = mockPersistedState<RwasState>({
  details: createEntity({}),
  adultFlags: {}
});
