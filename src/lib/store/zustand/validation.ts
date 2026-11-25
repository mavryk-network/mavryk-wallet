import { z } from 'zod';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
/** Far above any persisted shape (about six levels); bounds recursion over fetched third-party content. */
const MAX_SAFE_DEPTH = 64;

/** Own data properties of a plain object or array; any other container is structurally corrupt. */
function getOwnDataEntries(value: object): [string, unknown][] {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    throw new Error('Invalid persistence object prototype');
  }
  return Object.keys(value).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new Error('Persistence accessors are unsupported');
    return [key, descriptor.value];
  });
}

function assertSafeDataAt(value: unknown, depth: number): void {
  if (value === null || typeof value !== 'object') return;
  if (depth >= MAX_SAFE_DEPTH) throw new Error('Persistence value too deep');
  for (const [key, child] of getOwnDataEntries(value)) {
    if (UNSAFE_KEYS.has(key)) throw new Error('Unsafe persistence key');
    assertSafeDataAt(child, depth + 1);
  }
}

/**
 * Reject unsafe object graphs before schema parsing or merging, including nested metadata. Nesting is bounded by
 * MAX_SAFE_DEPTH, so a deeply nested value fails like an unsafe key instead of overflowing the stack.
 */
export function assertSafeData(value: unknown): void {
  assertSafeDataAt(value, 0);
}

/** Non-throwing form of assertSafeData, for dropping one record instead of failing its whole source. */
export function hasSafeData(value: unknown): boolean {
  try {
    assertSafeData(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shallow check of a container: a plain object or array of own data properties. Its keys and values are not inspected,
 * so callers must check every record they keep (see pickValidRecords).
 */
export function assertSafeContainer(value: unknown): void {
  if (value !== null && typeof value === 'object') getOwnDataEntries(value);
}

export const SAFE_KEY_SCHEMA = z
  .string()
  .min(1)
  .max(512)
  .refine(key => !UNSAFE_KEYS.has(key));

/** Validate before returning a detached, schema-selected durable snapshot. */
export function parseData<D>(schema: z.ZodType<D, z.ZodTypeDef, unknown>, value: unknown): D {
  assertSafeData(value);
  return schema.parse(value);
}

const isSafeContainer = (value: unknown) => {
  try {
    assertSafeContainer(value);
    return true;
  } catch {
    return false;
  }
};

/** A record map is a non-array object; z.custom keeps the reference, so no entry is copied before its own check. */
export const RECORD_MAP_SCHEMA = z.custom<Record<string, unknown>>(
  value => typeof value === 'object' && value !== null && !Array.isArray(value),
  'Invalid legacy record map'
);

/** Shallow-check a record map and return its entries. A non-map or corrupt container fails closed. */
function getRecordMapEntries(raw: unknown): [string, unknown][] {
  const source = RECORD_MAP_SCHEMA.parse(raw);
  assertSafeContainer(source);
  return Object.entries(source);
}

/**
 * Keep only the entries of a legacy record map whose key and value validate. Legacy maps hold fetched, third-party
 * content (token metadata, slugs, balances), so one oversized, malformed, unsafe or too deeply nested entry must be
 * skipped, never fail the whole migration. The container is checked shallowly and each value deeply, so unsafe keys
 * still never reach a destination; a structurally corrupt container fails closed.
 *
 * @param keySchema validates each key; it must reject unsafe keys (e.g. SAFE_KEY_SCHEMA)
 * @param valueSchema validates each value
 * @param raw the record map
 * @param onDrop called once per skipped entry
 * @returns a detached record of the valid entries
 */
export function pickValidRecords<V>(
  keySchema: z.ZodType<string, z.ZodTypeDef, unknown>,
  valueSchema: z.ZodType<V, z.ZodTypeDef, unknown>,
  raw: unknown,
  onDrop: () => void
): Record<string, V> {
  const records: Record<string, V> = {};
  for (const [key, value] of getRecordMapEntries(raw)) {
    const parsedKey = keySchema.safeParse(key);
    const parsedValue = parsedKey.success && hasSafeData(value) ? valueSchema.safeParse(value) : undefined;
    if (parsedKey.success && parsedValue?.success) records[parsedKey.data] = parsedValue.data;
    else onDrop();
  }
  return records;
}

/**
 * Keep the entries of a map of record maps (account → slug → record) whose key validates and whose value is a safe
 * record map. Inner maps are checked shallowly only: their records go through pickValidRecords, so one invalid record
 * drops itself, never its whole account.
 *
 * @param keySchema validates each outer key; it must reject unsafe keys
 * @param raw the outer map
 * @param onDrop called once per skipped outer entry
 * @returns a detached record of the inner maps, still unchecked per record
 */
export function pickValidRecordMaps(
  keySchema: z.ZodType<string, z.ZodTypeDef, unknown>,
  raw: unknown,
  onDrop: () => void
): Record<string, Record<string, unknown>> {
  const maps: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of getRecordMapEntries(raw)) {
    const parsedKey = keySchema.safeParse(key);
    const map = RECORD_MAP_SCHEMA.safeParse(value);
    if (parsedKey.success && map.success && isSafeContainer(map.data)) maps[parsedKey.data] = map.data;
    else onDrop();
  }
  return maps;
}

/** Report skipped legacy entries by count only; their content may be third-party data and is never logged. */
export function reportDroppedLegacyRecords(source: string, count: number) {
  if (count > 0) console.warn(`[migration] skipped ${count} invalid legacy ${source} record(s)`);
}

/** Normalize even null/undefined rejections so lifecycle failure cannot be mistaken for success. */
export const toPersistenceError = (error: unknown): Error =>
  error instanceof Error ? error : new Error('Persistence operation failed');
