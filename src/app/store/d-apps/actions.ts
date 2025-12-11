import { MavrykToolkit } from '@mavrykdynamics/webmavryk';

import { createActions } from 'lib/store';

export const loadTokensApyActions = createActions<MavrykToolkit, Record<string, number>>('d-apps/LOAD_TOKENS_APY');
