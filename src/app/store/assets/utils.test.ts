import { fetchTokensMetadata } from 'lib/apis/temple';
import { fetchTzktAccountAssets } from 'lib/apis/tzkt';
import { TempleChainId } from 'lib/temple/types';
import { fetchWalletRwaAssets } from 'mavryk/api/rwas';

import { loadAccountCollectibles, loadAccountRwas, loadAccountTokens } from './utils';

jest.mock('lib/apis/temple', () => ({ fetchTokensMetadata: jest.fn(), isKnownChainId: () => true }));
jest.mock('lib/apis/tzkt', () => ({ fetchTzktAccountAssets: jest.fn() }));
jest.mock('mavryk/api/client', () => ({ mavrykApi: { get: jest.fn() } }));
jest.mock('mavryk/api/rwas', () => ({
  ...jest.requireActual('mavryk/api/rwas'),
  fetchWalletRwaAssets: jest.fn()
}));

beforeEach(() => {
  jest.clearAllMocks();
  (fetchWalletRwaAssets as jest.Mock).mockResolvedValue([]);
});

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

const wrappedUsdt = 'KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v';
const assets = [
  { address: 'new-rwa', balance: 1.25, symbol: 'ANTH', metadata: { decimals: '6' } },
  { address: 'known-rwa', balance: 2, symbol: 'OCEAN', metadata: { decimals: '6' } },
  { address: wrappedUsdt, balance: 3, symbol: 'wUSDT', metadata: { decimals: '6' } }
];
const holding = (address: string, tokenId = '0') => ({
  token: { contract: { address }, tokenId },
  balance: '1250000'
});

it.each([true, null])(
  'partitions indexer fungibility=%s by contract, retaining the Basenet exception',
  async fungible => {
    (fetchWalletRwaAssets as jest.Mock).mockResolvedValue(assets);
    (fetchTzktAccountAssets as jest.Mock).mockImplementation(async (_account, _chain, branch) =>
      branch === fungible
        ? [holding('new-rwa'), holding('known-rwa'), holding(wrappedUsdt), holding('regular'), holding('new-rwa', '1')]
        : []
    );
    // A regular token sharing an old RWA symbol must not be misclassified by its name.
    (fetchTokensMetadata as jest.Mock).mockImplementation(async (_chain, slugs: string[]) =>
      slugs.map(() => ({ decimals: 6, symbol: 'OCEAN' }))
    );
    const account = `classification-${fungible}`;
    const tokens = await loadAccountTokens(account, TempleChainId.Basenet, new Map());
    const rwas = await loadAccountRwas(account, TempleChainId.Basenet, new Map());
    expect(tokens.slugs).toEqual([`${wrappedUsdt}_0`, 'regular_0', 'new-rwa_1']);
    expect(tokens.balances.regular_0).toBe('1250000');
    expect(rwas.slugs).toEqual(['new-rwa_0', 'known-rwa_0']);
    expect(rwas.balances['new-rwa_0']).toBe('1250000');
    expect(rwas.newMeta['new-rwa_0']).toMatchObject({ symbol: 'ANTH', decimals: 6 });
    expect(tokens.slugs.some(slug => rwas.slugs.includes(slug))).toBe(false);
  }
);

it('does not apply the Basenet exception on Mainnet or leak catalog membership across accounts', async () => {
  (fetchWalletRwaAssets as jest.Mock).mockImplementation(async ({ walletAddress }) =>
    walletAddress === 'catalog-owner' ? assets : []
  );
  (fetchTzktAccountAssets as jest.Mock).mockImplementation(async (_account, _chain, branch) =>
    branch === true ? [holding('new-rwa'), holding(wrappedUsdt)] : []
  );
  (fetchTokensMetadata as jest.Mock).mockImplementation(async (_chain, slugs: string[]) =>
    slugs.map(() => ({ decimals: 6, symbol: 'REG' }))
  );
  expect((await loadAccountRwas('catalog-owner', TempleChainId.Mainnet, new Map())).slugs).toContain(
    `${wrappedUsdt}_0`
  );
  expect((await loadAccountTokens('other-account', TempleChainId.Basenet, new Map())).slugs).toEqual([
    'new-rwa_0',
    `${wrappedUsdt}_0`
  ]);
});

it('rejects failed classification transport instead of publishing RWAs as ordinary tokens', async () => {
  (fetchWalletRwaAssets as jest.Mock).mockRejectedValue(new Error('catalog unavailable'));
  await expect(loadAccountTokens('failed-catalog', TempleChainId.Basenet, new Map())).rejects.toThrow(
    'catalog unavailable'
  );
});
