import { IS_DEV_ENV } from 'lib/env';

const TRUSTED_NEXUS_ORIGIN_HOSTS = new Set(['basenet.nexus.mavryk.org', 'nexus.mavryk.org']);
const TRUSTED_AUTH_CHALLENGE_SIGNER_HOSTS = new Set([...TRUSTED_NEXUS_ORIGIN_HOSTS, 'app.equiteez.com']);
// Preview deployments, the Equiteez Pages host and loopback origins are trusted in development builds only.
const DEV_TRUSTED_AUTH_CHALLENGE_SIGNER_HOSTS = new Set(['equiteez-app.pages.dev']);
const DEV_TRUSTED_NEXUS_ORIGIN_HOST_SUFFIXES = ['.mavryk-nexus.pages.dev'];
const DEV_TRUSTED_AUTH_CHALLENGE_SIGNER_HOST_SUFFIXES = [
  ...DEV_TRUSTED_NEXUS_ORIGIN_HOST_SUFFIXES,
  '.equiteez-app.pages.dev'
];
const DEV_LOCAL_TRUSTED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isTrustedNexusOrigin(origin?: string) {
  return isTrustedOrigin(origin, TRUSTED_NEXUS_ORIGIN_HOSTS, DEV_TRUSTED_NEXUS_ORIGIN_HOST_SUFFIXES);
}

export function isTrustedAuthChallengeSignerOrigin(origin?: string) {
  return isTrustedOrigin(
    origin,
    TRUSTED_AUTH_CHALLENGE_SIGNER_HOSTS,
    DEV_TRUSTED_AUTH_CHALLENGE_SIGNER_HOST_SUFFIXES,
    DEV_TRUSTED_AUTH_CHALLENGE_SIGNER_HOSTS
  );
}

function isTrustedOrigin(
  origin: string | undefined,
  trustedHosts: Set<string>,
  devTrustedHostSuffixes: string[],
  devTrustedHosts: Set<string> = new Set()
) {
  if (!origin) {
    return false;
  }

  try {
    const { hostname, port, protocol } = new URL(origin);

    if (IS_DEV_ENV && (protocol === 'http:' || protocol === 'https:') && DEV_LOCAL_TRUSTED_HOSTS.has(hostname)) {
      return true;
    }

    if (protocol !== 'https:') {
      return false;
    }

    if (port) {
      return false;
    }

    if (trustedHosts.has(hostname)) {
      return true;
    }

    return (
      IS_DEV_ENV &&
      (devTrustedHosts.has(hostname) || devTrustedHostSuffixes.some(hostSuffix => hostname.endsWith(hostSuffix)))
    );
  } catch {
    return false;
  }
}
