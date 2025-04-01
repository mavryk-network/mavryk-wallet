import { MavrykToolkit } from '@mavrykdynamics/taquito';

import { createActions } from 'lib/store';

export const loadTokensApyActions = createActions<MavrykToolkit, Record<string, number>>('d-apps/LOAD_TOKENS_APY');
