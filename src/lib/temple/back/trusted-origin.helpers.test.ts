import { isTrustedAuthChallengeSignerOrigin, isTrustedNexusOrigin } from './trusted-origin.helpers';

describe('trusted origin helpers', () => {
  it.each([
    'https://basenet.nexus.mavryk.org',
    'https://nexus.mavryk.org',
    'https://mav-3957-auth-2-for-contacts.mavryk-nexus.pages.dev',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000'
  ])('allows Nexus contacts bridge origin %s', origin => {
    expect(isTrustedNexusOrigin(origin)).toBe(true);
  });

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

  it('keeps Equiteez allowed only for auth challenge signing', () => {
    expect(isTrustedAuthChallengeSignerOrigin('https://app.equiteez.com')).toBe(true);
    expect(isTrustedNexusOrigin('https://app.equiteez.com')).toBe(false);
  });
});
