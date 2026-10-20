import { fetchTokensMetadata } from 'lib/apis/temple';
import { fetchTzktAccountAssets } from 'lib/apis/tzkt';
import { TempleChainId } from 'lib/temple/types';
import { fetchWalletRwaAssets } from 'mavryk/api/rwas';

import { loadAccountCollectibles, loadAccountRwas, loadAccountTokens } from './utils';

jest.mock('lib/apis/temple', () => ({ fetchTokensMetadata: jest.fn(), isKnownChainId: () => true }));
jest.mock('lib/apis/tzkt', () => ({ fetchTzktAccountAssets: jest.fn() }));
jest.mock('mavryk/api/client', () => ({ mavrykApi: {} }));
jest.mock('mavryk/api/rwas', () => ({
  ...jest.requireActual('mavryk/api/rwas'),
  fetchWalletRwaAssets: jest.fn().mockResolvedValue([])
}));

it('rejects incomplete/failed unknown classification instead of treating it as an empty fetched list', async () => {
  (fetchTzktAccountAssets as jest.Mock).mockImplementation(async (_account, _chain, fungible) =>
    fungible === null ? [{ token: { contract: { address: 'KT1test' }, tokenId: '0' }, balance: '10' }] : []
  );
  (fetchTokensMetadata as jest.Mock).mockResolvedValue([]);
  await expect(loadAccountCollectibles('incomplete', TempleChainId.Mainnet, new Map())).rejects.toThrow('Incomplete');
  (fetchTokensMetadata as jest.Mock).mockRejectedValue(new Error('offline'));
  await expect(loadAccountCollectibles('offline', TempleChainId.Mainnet, new Map())).rejects.toThrow('offline');
  (fetchTokensMetadata as jest.Mock).mockResolvedValue([null]);
  await expect(loadAccountCollectibles('missing', TempleChainId.Mainnet, new Map())).rejects.toThrow('Incomplete');
  (fetchTokensMetadata as jest.Mock).mockResolvedValue([{ artifactUri: 'ipfs://nft', decimals: 0 }]);
  await expect(loadAccountCollectibles('nft', TempleChainId.Mainnet, new Map())).resolves.toMatchObject({
    slugs: ['KT1test_0'],
    balances: { KT1test_0: '10' }
  });
  (fetchTzktAccountAssets as jest.Mock).mockResolvedValue([]);
  (fetchTokensMetadata as jest.Mock).mockResolvedValue([]);
  await expect(loadAccountTokens('empty', TempleChainId.Mainnet, new Map())).resolves.toEqual({
    slugs: [],
    balances: {},
    newMeta: {}
  });
});

it.each([true, null])('separates API-classified RWAs from tokens for indexer fungible=%s', async fungible => {
  const rwa = { address: 'KT1rwa', symbol: 'NEW-RWA', balance: 10, metadata: { decimals: 0 } };
  const regular = { decimals: 0, symbol: 'OCEAN', name: 'Regular token with a reused symbol' };
  (fetchWalletRwaAssets as jest.Mock).mockResolvedValue([rwa]);
  (fetchTzktAccountAssets as jest.Mock).mockImplementation(async (_account, _chain, type) =>
    type === fungible
      ? ['KT1rwa', 'KT1regular'].map(address => ({ token: { contract: { address }, tokenId: '0' }, balance: '10' }))
      : []
  );
  (fetchTokensMetadata as jest.Mock).mockImplementation(async (_chain, slugs: string[]) => slugs.map(() => regular));
  const account = `classification-${fungible}`;
  const tokens = await loadAccountTokens(account, TempleChainId.Mainnet, new Map());
  const rwas = await loadAccountRwas(account, TempleChainId.Mainnet, new Map());
  expect(tokens.slugs).toEqual(['KT1regular_0']);
  expect(tokens.balances).toEqual({ KT1regular_0: '10' });
  expect(rwas.slugs).toEqual(['KT1rwa_0']);
  expect(rwas.newMeta.KT1rwa_0).toMatchObject({ symbol: 'NEW-RWA' });
});

it('propagates RWA classification failures instead of publishing RWAs as tokens', async () => {
  (fetchTzktAccountAssets as jest.Mock).mockResolvedValue([]);
  (fetchWalletRwaAssets as jest.Mock).mockRejectedValue(new Error('RWA endpoint unavailable'));
  await expect(loadAccountTokens('failed-rwas', TempleChainId.Mainnet, new Map())).rejects.toThrow(
    'RWA endpoint unavailable'
  );
});
