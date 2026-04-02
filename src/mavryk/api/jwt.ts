type JwtPayload = Record<string, unknown>;

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

  return atob(padded);
}

function parseJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const decoded = decodeBase64Url(parts[1]);
    const parsed: unknown = JSON.parse(decoded);

    if (!parsed || typeof parsed !== 'object') return null;

    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

function toExpMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value * 1000;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed * 1000;
  }

  return null;
}

export function getJwtExpMs(token: string): number | null {
  const payload = parseJwtPayload(token);
  if (!payload) return null;

  return toExpMs(payload.exp);
}

export function isJwtExpired(token: string, nowMs = Date.now()) {
  const expMs = getJwtExpMs(token);
  if (!expMs) return true;

  return expMs <= nowMs;
}

export function isJwtExpiringSoon(token: string, thresholdMs: number, nowMs = Date.now()) {
  const expMs = getJwtExpMs(token);
  if (!expMs) return true;

  return expMs - nowMs <= thresholdMs;
}
