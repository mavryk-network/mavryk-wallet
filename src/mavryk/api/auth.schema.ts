import { z } from 'zod';

export const AuthChallengeResponseSchema = z.object({
  challenge: z.string(),
  expiresAt: z.string(),
  nonce: z.string()
});

export const AuthVerifyResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string()
});

export const AuthRefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string()
});

export type AuthChallengeResponse = z.infer<typeof AuthChallengeResponseSchema>;
export type AuthVerifyResponse = z.infer<typeof AuthVerifyResponseSchema>;
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;
