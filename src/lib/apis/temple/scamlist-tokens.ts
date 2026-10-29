import axios from 'axios';

import { SCAMLIST_SCHEMA } from 'lib/store/zustand/security-state.schema';
import { parseData } from 'lib/store/zustand/validation';

const scamlistApi = axios.create({
  baseURL: 'https://raw.githubusercontent.com/madfish-solutions/tokens-scamlist/master/'
});

/** Missing/malformed payloads reject; only validated responses may replace durable labels. */
export const fetchScamlistTokens = () =>
  scamlistApi
    .get<{ slugs: unknown }>('tokens/scamlist.json')
    .then(({ data }) => parseData(SCAMLIST_SCHEMA, data.slugs));
