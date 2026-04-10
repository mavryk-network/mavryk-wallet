import { z } from 'zod';

export const dodoAssetsContractsSchema = z.object({
  dodo_mav: z.array(
    z.object({
      base_token: z.object({
        address: z.string(),
        token_id: z.number().int()
      })
    })
  )
});

export const AssetDetailsSchema = z
  .object({
    propertyDetails: z
      .object({
        description: z.string().optional()
      })
      .optional()
  })
  .nullable();

export const RwaTokenMetadataSchema = z.object({
  token: z.array(
    z.object({
      address: z.string(),
      token_metadata: z.object({
        decimals: z.number(),
        thumbnailUri: z
          .string()
          .regex(/^https:\/\//)
          .refine(uri => {
            try {
              const { hostname } = new URL(uri);
              const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
              const isPrivate = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname);
              const isIPv6LinkLocal = /^fe80:/i.test(hostname);
              return !blocked.includes(hostname) && !isPrivate && !isIPv6LinkLocal;
            } catch {
              return false;
            }
          }, 'Disallowed URI hostname')
          .optional()
          .nullable(),
        name: z.string().optional().nullable(),
        symbol: z.string().optional().nullable(),
        shouldPreferSymbol: z.boolean().optional().nullable(),
        assetDetails: z.string().optional().nullable()
      })
    })
  )
});
