import { CLOCK_SKEW_TOLERANCE_MS, isJwtExpired, isJwtExpiringSoon } from './jwt';

const NOW_MS = Date.parse('2030-01-01T00:00:00.000Z');

function buildJwt(expiresAtMs: number) {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return [encode({ alg: 'none' }), encode({ exp: Math.floor(expiresAtMs / 1000) }), 'signature'].join('.');
}

describe('isJwtExpired', () => {
  it('judges expiry by the local clock when no tolerance is given', () => {
    expect(isJwtExpired(buildJwt(NOW_MS + 1000), NOW_MS)).toBe(false);
    expect(isJwtExpired(buildJwt(NOW_MS - 1000), NOW_MS)).toBe(true);
  });

  it('accepts a token that expired within the clock skew tolerance (local clock ahead)', () => {
    const token = buildJwt(NOW_MS - CLOCK_SKEW_TOLERANCE_MS + 1000);

    expect(isJwtExpired(token, NOW_MS, CLOCK_SKEW_TOLERANCE_MS)).toBe(false);
  });

  it('rejects a token that expired beyond the clock skew tolerance', () => {
    const token = buildJwt(NOW_MS - CLOCK_SKEW_TOLERANCE_MS - 1000);

    expect(isJwtExpired(token, NOW_MS, CLOCK_SKEW_TOLERANCE_MS)).toBe(true);
  });

  it('accepts a token still valid by the local clock (local clock behind)', () => {
    expect(isJwtExpired(buildJwt(NOW_MS + CLOCK_SKEW_TOLERANCE_MS), NOW_MS, CLOCK_SKEW_TOLERANCE_MS)).toBe(false);
  });

  it('treats tokens without a parseable exp as expired regardless of tolerance', () => {
    expect(isJwtExpired('not-a-jwt', NOW_MS, CLOCK_SKEW_TOLERANCE_MS)).toBe(true);
  });
});

describe('isJwtExpiringSoon', () => {
  it('keeps the refresh-ahead threshold free of the skew tolerance', () => {
    expect(isJwtExpiringSoon(buildJwt(NOW_MS + 30_000), 60_000, NOW_MS)).toBe(true);
    expect(isJwtExpiringSoon(buildJwt(NOW_MS + 90_000), 60_000, NOW_MS)).toBe(false);
  });
});
