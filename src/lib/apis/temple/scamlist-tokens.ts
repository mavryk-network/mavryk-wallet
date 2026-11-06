import axios from 'axios';

import { SCAMLIST_SCHEMA } from 'lib/store/zustand/security-state.schema';
import { parseData } from 'lib/store/zustand/validation';

// Upstream Temple (madfish-solutions) list, pinned 2026-11-02 to a master commit so it cannot change without review.
const scamlistApi = axios.create({
  baseURL:
    'https://raw.githubusercontent.com/madfish-solutions/tokens-scamlist/c4a94a5c1eaef5a616f87f291a3980aad30d9934/'
});

/** Missing/malformed payloads reject; only validated responses may replace durable labels. */
export const fetchScamlistTokens = () =>
  scamlistApi
    .get<{ slugs: unknown }>('tokens/scamlist.json')
    .then(({ data }) => parseData(SCAMLIST_SCHEMA, data.slugs));
