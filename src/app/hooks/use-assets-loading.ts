/**
 * Re-exports the Zustand/TanStack Query-based assets loading hook.
 *
 * The old Redux epic-based implementation has been replaced.
 * This file is kept as a thin re-export so existing imports continue to work.
 */
export { useAssetsLoading } from 'lib/assets/use-assets-query';
