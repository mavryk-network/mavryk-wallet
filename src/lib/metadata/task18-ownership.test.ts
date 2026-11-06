import fs from 'fs';
import path from 'path';

const source = (file: string) => fs.readFileSync(path.join(__dirname, '../../', file), 'utf8');

it('retires all metadata epics and direct foreground fetch bypasses while preserving migration transport', () => {
  for (const category of ['tokens', 'collectibles', 'rwas']) {
    expect(fs.existsSync(path.join(__dirname, `../../app/store/${category}-metadata/epics.ts`))).toBe(false);
    expect(source(`app/store/${category}-metadata/selectors.ts`)).toContain('useOwnedMetadata');
    expect(source(`app/store/${category}-metadata/selectors.ts`)).not.toContain('useSelector');
  }
  expect(source('app/store/root-state.epics.ts')).not.toMatch(/MetadataEpics/);
  expect(source('lib/metadata/index.ts')).not.toMatch(/checkedRef|dispatch|loadTokensMetadataAction/);
  for (const category of ['collectibles', 'rwas'])
    expect(source(`app/hooks/use-${category}-pagination-logic.ts`)).not.toMatch(/loadTokensMetadata|dispatch/);
  expect(source('app/pages/AddAsset/AddAsset.tsx')).not.toMatch(
    /fetchOneTokenMetadata|putTokensMetadataAction|putCollectiblesMetadataAction/
  );
  expect(source('app/hooks/use-metadata-refresh.ts')).not.toMatch(/fetchWalletTokens|dispatch|useLocalStorage/);
  expect(source('lib/assets/indexeddb-migration-owner.ts')).toContain('fetchOneTokenMetadata');
  expect(source('lib/metadata/metadata-query.ts')).not.toMatch(
    /createMetadataStore|metadataStore|setQueryData\([^\n]*records/
  );
});
