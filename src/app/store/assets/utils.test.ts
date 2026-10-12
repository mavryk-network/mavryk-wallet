import { fetchTokensMetadata } from 'lib/apis/temple';
import { fetchTzktAccountAssets } from 'lib/apis/tzkt';
import { TempleChainId } from 'lib/temple/types';

import { loadAccountCollectibles, loadAccountTokens } from './utils';

jest.mock('lib/apis/temple', () => ({ fetchTokensMetadata: jest.fn(), isKnownChainId: () => true }));
jest.mock('lib/apis/tzkt', () => ({ fetchTzktAccountAssets: jest.fn() }));
jest.mock('mavryk/api/rwas', () => ({}));

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
