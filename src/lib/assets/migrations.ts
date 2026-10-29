import { updateOwnedUI } from 'lib/store/zustand/ui-client';

export const ASSETS_MIGRATION_NAME = 'assets-migrations@3.0.0';

/** Await the single owner's verified destination writes and transactional source cleanup. */
export const migrateFromIndexedDB = () => updateOwnedUI({ kind: 'indexeddb-assets-migration' });
