const TRUSTED_NEXUS_ORIGIN_HOSTS = new Set(['basenet.nexus.mavryk.org', 'nexus.mavryk.org']);
const TRUSTED_NEXUS_ORIGIN_HOST_SUFFIXES = ['.mavryk-nexus.pages.dev'];
const TRUSTED_AUTH_CHALLENGE_SIGNER_HOSTS = new Set([
  ...TRUSTED_NEXUS_ORIGIN_HOSTS,
  'app.equiteez.com',
  'equiteez-app.pages.dev'
]);
const TRUSTED_AUTH_CHALLENGE_SIGNER_HOST_SUFFIXES = [...TRUSTED_NEXUS_ORIGIN_HOST_SUFFIXES, '.equiteez-app.pages.dev'];
const LOCAL_TRUSTED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isTrustedNexusOrigin(origin?: string) {
  return isTrustedOrigin(origin, TRUSTED_NEXUS_ORIGIN_HOSTS, TRUSTED_NEXUS_ORIGIN_HOST_SUFFIXES);
}

export function isTrustedAuthChallengeSignerOrigin(origin?: string) {
  return isTrustedOrigin(origin, TRUSTED_AUTH_CHALLENGE_SIGNER_HOSTS, TRUSTED_AUTH_CHALLENGE_SIGNER_HOST_SUFFIXES);
}

function isTrustedOrigin(origin: string | undefined, trustedHosts: Set<string>, trustedHostSuffixes: string[]) {
  if (!origin) {
    return false;
  }

  try {
    const { hostname, port, protocol } = new URL(origin);

    if ((protocol === 'http:' || protocol === 'https:') && LOCAL_TRUSTED_HOSTS.has(hostname)) {
      return true;
    }

    if (protocol !== 'https:') {
      return false;
    }

    if (port) {
      return false;
    }

    return trustedHosts.has(hostname) || trustedHostSuffixes.some(hostSuffix => hostname.endsWith(hostSuffix));
  } catch {
    return false;
  }
}
