import { LEGACY_ASSETS_KEYS } from './legacy-assets-source';

export const OWNER_FALLBACK_KEYS = [...LEGACY_ASSETS_KEYS, 'persist:temple-root-task11'] as const;
export type OwnerFallbackKey = (typeof OWNER_FALLBACK_KEYS)[number];
