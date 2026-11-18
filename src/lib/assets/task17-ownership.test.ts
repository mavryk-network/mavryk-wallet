import fs from 'fs';
import path from 'path';

import { assetsKeys } from 'lib/query-keys';

const source = (file: string) => fs.readFileSync(path.join(__dirname, '../../', file), 'utf8');

it('isolates every asset request input and retains fixed global security keys', () => {
  const keys = new Set<string>();
  for (const category of ['tokens', 'collectibles', 'rwas'] as const)
    for (const account of ['a', 'b'])
      for (const chain of ['one', 'two'])
        for (const network of ['mainnet', 'basenet'])
          keys.add(JSON.stringify(assetsKeys.account(category, account, chain, network)));
  expect(keys.size).toBe(24);
  expect(assetsKeys.security('scamlist')).not.toEqual(assetsKeys.security('whitelist'));
});

it('keeps old fetchers inert, durable reads owner-backed, and Query drivers free from loading self-gates', () => {
  expect(source('app/store/root-state.epics.ts')).not.toContain('assetsEpics');
  expect(fs.existsSync(path.join(__dirname, '../../app/store/assets/epics.ts'))).toBe(false);
  expect(source('app/hooks/use-assets-loading.ts')).not.toMatch(/dispatch|useInterval|AreAssetsLoading/);
  expect(source('app/WithDataLoading.tsx')).not.toContain('loadTokensScamlistActions');
  expect(source('app/store/assets/reducer.ts')).not.toMatch(/loadAccount|loadTokensWhitelist|loadTokensScamlist/);
  expect(source('app/store/owned-assets.middleware.ts')).not.toContain('loadAccount');
  expect(source('app/store/assets/selectors.ts')).not.toContain('useSelector');
  expect(source('lib/assets/use-assets-query.ts')).not.toMatch(/tokensAreLoading|!.*Fetching|keepPreviousData/);
  expect(source('lib/assets/load-account-assets.ts')).not.toMatch(
    /putTokensMetadataAction|putCollectiblesMetadataAction|putRwasMetadataAction/
  );
  expect(source('app/pages/Home/OtherComponents/Tokens/Tokens.tsx')).toMatch(
    /mainnetTokensScamSlugsRecord,\s+publicKeyHash,\s+handleAssetOpen/
  );
});
