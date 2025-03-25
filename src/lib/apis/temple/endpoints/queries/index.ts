import { z } from 'zod';

const BaseTokenSchema = z.object({
  token_id: z.number(),
  address: z.string(),
  dodo_mav_base_tokens: z.array(
    z.object({
      base_token: z.object({ token_metadata: z.object({ decimals: z.string() }).nullable() })
    })
  )
});

const DodoMavItemSchema = z.object({
  address: z.string(),
  fee_decimals: z.number(),
  guide_price: z.number(),
  slippage_factor: z.number(),
  base_balance: z.number(),
  quote_balance: z.number(),
  target_base_token_amount: z.number(),
  target_quote_token_amount: z.number(),
  base_balance_limit: z.number(),
  quote_balance_limit: z.number(),
  r_status: z.number(),
  price_model: z.number(),
  maintainer_fee: z.number(),
  lp_fee: z.number(),
  base_token: BaseTokenSchema
});

export const DodoStorageSchema = z.object({
  dodo_mav: z.array(DodoMavItemSchema)
});

export type DodoMavItemType = z.infer<typeof DodoMavItemSchema>;

export const DEX_STORAGE_QUERY = `
  query DexStorage {
dodo_mav {
  address
  fee_decimals
  guide_price
  slippage_factor
  fixed_price_percent
  base_balance
  quote_balance
  target_base_token_amount
  target_quote_token_amount
  base_balance_limit
  quote_balance_limit
  metadata
  r_status
  price_model
  maintainer_fee
  lp_fee
  quote_token {
    token_id
    address
  }
  quote_lp_token {
    address
    token_id
  }
  base_lp_token {
    address
    token_id
  }
  base_token {
    token_id
    address
      dodo_mav_base_tokens {
        base_token {
          token_metadata
        }
      }
  }
}
}
`;
