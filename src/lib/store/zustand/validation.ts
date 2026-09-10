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
export function parseData<D>(schema: z.ZodType<D>, value: unknown): D {
  assertSafeData(value);
  return schema.parse(value);
}

/** Normalize even null/undefined rejections so lifecycle failure cannot be mistaken for success. */
export const toPersistenceError = (error: unknown): Error =>
  error instanceof Error ? error : new Error('Persistence operation failed');
