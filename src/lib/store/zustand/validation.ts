import { z } from 'zod';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Reject unsafe object graphs before schema parsing or merging, including nested metadata. */
export function assertSafeData(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null &&
    !Array.isArray(value)
  ) {
    throw new Error('Invalid persistence object prototype');
  }
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key)) throw new Error('Unsafe persistence key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new Error('Persistence accessors are unsupported');
    assertSafeData(descriptor.value);
  }
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

const RECORD_OBJECT_SCHEMA = z.record(z.unknown());

/**
 * Keep only the entries of a legacy record map whose key and value validate. Legacy maps hold fetched, third-party
 * content (token metadata, slugs, balances), so one oversized or malformed entry must be skipped, never fail the whole
 * migration. The container itself must still be a safe plain object: a structurally corrupt slice fails closed.
 *
 * @param keySchema validates each key
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
  const source = parseData(RECORD_OBJECT_SCHEMA, raw);
  const records: Record<string, V> = {};
  for (const [key, value] of Object.entries(source)) {
    const parsedKey = keySchema.safeParse(key);
    const parsedValue = valueSchema.safeParse(value);
    if (parsedKey.success && parsedValue.success) records[parsedKey.data] = parsedValue.data;
    else onDrop();
  }
  return records;
}

/** Report skipped legacy entries by count only; their content may be third-party data and is never logged. */
export function reportDroppedLegacyRecords(source: string, count: number) {
  if (count > 0) console.warn(`[migration] skipped ${count} invalid legacy ${source} record(s)`);
}

/** Normalize even null/undefined rejections so lifecycle failure cannot be mistaken for success. */
export const toPersistenceError = (error: unknown): Error =>
  error instanceof Error ? error : new Error('Persistence operation failed');
