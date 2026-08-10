import { z } from 'zod';

import { AUTH_CHALLENGE_MAX_LENGTH, AUTH_CHALLENGE_NONCE_PATTERN } from './auth-payload.helpers';
import { getJwtExpMs, isJwtExpired } from './jwt';

const MAX_REFRESH_TOKEN_LENGTH = 4096;

const AccessTokenSchema = z
  .string()
  .refine(token => token.split('.').length === 3, 'Access token must be a JWT')
  .refine(token => getJwtExpMs(token) !== null, 'Access token must include a parseable exp claim')
  .refine(token => !isJwtExpired(token), 'Access token is expired');

const RefreshTokenSchema = z.string().trim().min(1).max(MAX_REFRESH_TOKEN_LENGTH);

export const AuthChallengeResponseSchema = z.object({
  challenge: z.string().min(1).max(AUTH_CHALLENGE_MAX_LENGTH),
  expiresAt: z.string().min(1),
  nonce: z.string().regex(AUTH_CHALLENGE_NONCE_PATTERN)
});

export const AuthVerifyResponseSchema = z.object({
  accessToken: AccessTokenSchema,
  refreshToken: RefreshTokenSchema
});

export const AuthRefreshResponseSchema = z.object({
  accessToken: AccessTokenSchema,
  refreshToken: RefreshTokenSchema
});

export type AuthChallengeResponse = z.infer<typeof AuthChallengeResponseSchema>;
export type AuthVerifyResponse = z.infer<typeof AuthVerifyResponseSchema>;
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;
