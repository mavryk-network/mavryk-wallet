import { migrateFromIndexedDB } from 'lib/assets/migrations';
import { migrate } from 'lib/local-storage/migrator';
import { useAllTokensMetadataSelector } from 'lib/store/zustand/metadata.store';
import { useDidMount } from 'lib/ui/hooks';

export const useAssetsMigrations = () => {
  const allMetadatas = useAllTokensMetadataSelector();

  useDidMount(
    () =>
      void migrate([
        {
          name: 'assets-migrations@1.18.2',
          up: () => migrateFromIndexedDB(allMetadatas)
        }
      ])
  );
};
