import { ASSETS_MIGRATION_NAME, migrateFromIndexedDB } from 'lib/assets/migrations';
import { migrate } from 'lib/local-storage/migrator';
import { useDidMount } from 'lib/ui/hooks';

export const useAssetsMigrations = () => {
  // Request the background migration on mount; page teardown does not cancel its durable operation.
  useDidMount(
    () =>
      void migrate([
        {
          name: ASSETS_MIGRATION_NAME,
          up: migrateFromIndexedDB
        }
      ]).catch(() => console.error('Asset migration failed. Retry on the next startup.'))
  );
};
