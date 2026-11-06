import { z } from 'zod';

import { SAFE_KEY_SCHEMA } from './validation';

export const SCAMLIST_SCHEMA = z.record(SAFE_KEY_SCHEMA, z.boolean());
export const WHITELIST_SCHEMA = z.array(SAFE_KEY_SCHEMA);
export const LEGACY_SECURITY_SCHEMA = z.object({
  mainnetWhitelist: z.object({ data: WHITELIST_SCHEMA }),
  mainnetScamlist: z.object({ data: SCAMLIST_SCHEMA })
});
