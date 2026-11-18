type TrustedOriginHelpers = typeof import('./trusted-origin.helpers');

const loadHelpers = (isDevEnv: boolean) => {
  let helpers: TrustedOriginHelpers | undefined;

  jest.isolateModules(() => {
    jest.doMock('lib/env', () => ({ IS_DEV_ENV: isDevEnv }));
    helpers = require('./trusted-origin.helpers');
  });

  if (!helpers) throw new Error('Failed to load trusted origin helpers');

  return helpers;
};

const LOOPBACK_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:3000',
  'https://127.0.0.1',
  'http://[::1]:8080'
];

const PREVIEW_ORIGINS = [
  'https://mav-3957-auth-2-for-contacts.mavryk-nexus.pages.dev',
  'https://x.equiteez-app.pages.dev',
  'https://equiteez-app.pages.dev'
];

describe('trusted origin helpers (production build)', () => {
  const { isTrustedAuthChallengeSignerOrigin, isTrustedNexusOrigin } = loadHelpers(false);

  it.each(['https://basenet.nexus.mavryk.org', 'https://nexus.mavryk.org'])(
    'allows Nexus contacts bridge origin %s',
    origin => {
      expect(isTrustedNexusOrigin(origin)).toBe(true);
    }
  );

  it.each([
    'https://app.equiteez.com',
    'http://nexus.mavryk.org',
    'https://nexus.mavryk.org:444',
    'https://nexus.mavryk.org.evil.com',
    'https://mav-3957-auth-2-for-contacts.mavryk-nexus.pages.dev:444',
    'https://malicious-mavryk-nexus.pages.dev',
    'https://mavryk-nexus.pages.dev.evil.com',
    'https://localhost.evil.com',
    'http://127.0.0.2:3000'
  ])('rejects non-Nexus contacts bridge origin %s', origin => {
    expect(isTrustedNexusOrigin(origin)).toBe(false);
  });

  it.each([...LOOPBACK_ORIGINS, ...PREVIEW_ORIGINS])('rejects development-only origin %s', origin => {
    expect(isTrustedNexusOrigin(origin)).toBe(false);
    expect(isTrustedAuthChallengeSignerOrigin(origin)).toBe(false);
  });

  it.each(['https://basenet.nexus.mavryk.org', 'https://nexus.mavryk.org', 'https://app.equiteez.com'])(
    'allows auth challenge signer origin %s',
    origin => {
      expect(isTrustedAuthChallengeSignerOrigin(origin)).toBe(true);
    }
  );

  it('keeps Equiteez allowed only for auth challenge signing', () => {
    expect(isTrustedAuthChallengeSignerOrigin('https://app.equiteez.com')).toBe(true);
    expect(isTrustedNexusOrigin('https://app.equiteez.com')).toBe(false);
  });
});

describe('trusted origin helpers (development build)', () => {
  const { isTrustedAuthChallengeSignerOrigin, isTrustedNexusOrigin } = loadHelpers(true);

  it.each(LOOPBACK_ORIGINS)('allows loopback origin %s', origin => {
    expect(isTrustedNexusOrigin(origin)).toBe(true);
    expect(isTrustedAuthChallengeSignerOrigin(origin)).toBe(true);
  });

  it('allows preview deployment origins', () => {
    expect(isTrustedNexusOrigin('https://mav-3957-auth-2-for-contacts.mavryk-nexus.pages.dev')).toBe(true);
    expect(isTrustedAuthChallengeSignerOrigin('https://x.equiteez-app.pages.dev')).toBe(true);
    expect(isTrustedNexusOrigin('https://x.equiteez-app.pages.dev')).toBe(false);
  });

  it('trusts the Equiteez Pages host for auth challenge signing only', () => {
    expect(isTrustedAuthChallengeSignerOrigin('https://equiteez-app.pages.dev')).toBe(true);
    expect(isTrustedNexusOrigin('https://equiteez-app.pages.dev')).toBe(false);
    expect(isTrustedAuthChallengeSignerOrigin('http://equiteez-app.pages.dev')).toBe(false);
    expect(isTrustedAuthChallengeSignerOrigin('https://equiteez-app.pages.dev:444')).toBe(false);
  });

  it('still rejects lookalike origins', () => {
    expect(isTrustedNexusOrigin('https://localhost.evil.com')).toBe(false);
    expect(isTrustedNexusOrigin('https://malicious-mavryk-nexus.pages.dev')).toBe(false);
  });
});

export {};
