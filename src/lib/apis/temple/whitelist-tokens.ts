import axios from 'axios';
import { z } from 'zod';

import { parseData, SAFE_KEY_SCHEMA } from 'lib/store/zustand/validation';

export interface WhitelistResponseToken {
  contractAddress: 'mav' | string;
  fa2TokenId?: number;
  network: 'mainnet' | string;
  metadata: WhitelistResponseMetadata;
  type: 'FA2' | 'FA12';
}

interface WhitelistResponseMetadata {
  decimals: number;
  name: string;
  symbol: string;
  thumbnailUri?: string;
  description?: string;
}

const whitelistResponseSchema = z.array(
  z.object({
    contractAddress: SAFE_KEY_SCHEMA,
    fa2TokenId: z.number().int().nonnegative().optional(),
    network: z.string(),
    type: z.enum(['FA2', 'FA12']),
    metadata: z.object({
      decimals: z.number().int().nonnegative(),
      name: z.string(),
      symbol: z.string(),
      thumbnailUri: z.string().optional(),
      description: z.string().optional()
    })
  })
);

// Upstream Temple (madfish-solutions) list, pinned 2026-11-02 to a master commit so it cannot change without review.
const WHITELIST_TOKENS_BASE_URL =
  'https://raw.githubusercontent.com/madfish-solutions/tokens-whitelist/3df9b1a3920a7d07a4eaa13120e8ccd1bb9a53fb/';

const api = axios.create({ baseURL: WHITELIST_TOKENS_BASE_URL });

/** A successful empty list is distinct from an absent tokens field. */
export const fetchWhitelistTokens = () =>
  api
    .get<{ tokens: unknown }>('tokens/quipuswap.whitelist.json')
    .then(({ data }) => parseData(whitelistResponseSchema, data.tokens));
