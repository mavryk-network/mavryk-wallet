import { z } from 'zod';

/**
 * The only events (and properties) the wallet may send to PostHog.
 * Every schema is strict: unknown keys reject the whole event, so addresses, keys, hashes, amounts,
 * dApp origins or free-form error text can never be attached by accident.
 */

const EMPTY_PROPERTIES_SCHEMA = z.object({}).strict();

export const ANALYTICS_NETWORK_SCHEMA = z.enum(['mainnet', 'basenet', 'custom']);
export type AnalyticsNetwork = z.infer<typeof ANALYTICS_NETWORK_SCHEMA>;

export const ANALYTICS_TX_TYPE_SCHEMA = z.enum([
  'send',
  'delegate',
  'stake',
  'contract_call',
  'origination',
  'batch',
  'other'
]);
export type AnalyticsTxType = z.infer<typeof ANALYTICS_TX_TYPE_SCHEMA>;

export const ANALYTICS_ASSET_TYPE_SCHEMA = z.enum(['mvrk', 'token', 'none']);
export type AnalyticsAssetType = z.infer<typeof ANALYTICS_ASSET_TYPE_SCHEMA>;

const TX_SOURCE_SCHEMA = z.enum(['wallet', 'dapp']);
export type AnalyticsTxSource = z.infer<typeof TX_SOURCE_SCHEMA>;

/** Sanitized error codes only, e.g. `contract.balance_too_low` or `NOT_GRANTED`. */
export const ANALYTICS_ERROR_CODE_SCHEMA = z.string().regex(/^[A-Za-z0-9_.]{1,100}$/);

export const ANALYTICS_EVENT_SCHEMAS = {
  wallet_created: EMPTY_PROPERTIES_SCHEMA,
  wallet_imported: z.object({ method: z.enum(['seed', 'keystore']) }).strict(),
  wallet_unlocked: EMPTY_PROPERTIES_SCHEMA,
  account_added: z.object({ type: z.enum(['hd', 'imported', 'ledger', 'watch_only']) }).strict(),
  contact_added: z.object({ method: z.enum(['manual', 'import']) }).strict(),
  tx_confirmed: z
    .object({ tx_type: ANALYTICS_TX_TYPE_SCHEMA, asset_type: ANALYTICS_ASSET_TYPE_SCHEMA, source: TX_SOURCE_SCHEMA })
    .strict(),
  tx_rejected: z.object({ tx_type: ANALYTICS_TX_TYPE_SCHEMA, source: TX_SOURCE_SCHEMA }).strict(),
  tx_failed: z
    .object({ tx_type: ANALYTICS_TX_TYPE_SCHEMA, source: TX_SOURCE_SCHEMA, error_code: ANALYTICS_ERROR_CODE_SCHEMA })
    .strict(),
  dapp_connected: EMPTY_PROPERTIES_SCHEMA,
  dapp_connection_rejected: EMPTY_PROPERTIES_SCHEMA,
  network_switched: z.object({ network: ANALYTICS_NETWORK_SCHEMA }).strict(),
  /** Sent only when analytics gets enabled: after an opt-out nothing is sent at all. */
  analytics_opt_in_changed: z.object({ enabled: z.literal(true) }).strict()
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_SCHEMAS;

export type AnalyticsEventProperties<E extends AnalyticsEventName> = z.infer<(typeof ANALYTICS_EVENT_SCHEMAS)[E]>;

/** Events that extension pages may request; all the others are emitted by the background only. */
export const FOREGROUND_ANALYTICS_EVENTS = [
  'wallet_created',
  'wallet_imported',
  'contact_added',
  'analytics_opt_in_changed'
] as const;

export type ForegroundAnalyticsEventName = (typeof FOREGROUND_ANALYTICS_EVENTS)[number];

export const isForegroundAnalyticsEvent = (event: string): event is ForegroundAnalyticsEventName =>
  (FOREGROUND_ANALYTICS_EVENTS as readonly string[]).includes(event);

/**
 * Validates event properties against the whitelist.
 * @returns Parsed properties, or `null` when the event must not be sent.
 */
export const parseAnalyticsEventProperties = (event: string, properties: unknown): Record<string, unknown> | null => {
  if (!Object.prototype.hasOwnProperty.call(ANALYTICS_EVENT_SCHEMAS, event)) return null;
  const result = ANALYTICS_EVENT_SCHEMAS[event as AnalyticsEventName].safeParse(properties ?? {});

  return result.success ? result.data : null;
};
