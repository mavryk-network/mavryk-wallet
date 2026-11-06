import { MavrykToolkit } from '@mavrykdynamics/webmavryk';

import { fetchTokensMetadata } from 'lib/apis/temple/metadata';

import { loadTokensMetadataStrict } from './fetch';
import { fetchTokenMetadata } from './on-chain';

jest.mock('@mavrykdynamics/webmavryk', () => ({ MavrykToolkit: jest.fn() }));
jest.mock('lib/apis/temple/metadata', () => ({
  fetchTokensMetadata: jest.fn(),
  fetchOneTokenMetadata: jest.fn(),
  isKnownChainId: (chain: string) => chain === 'known'
}));
jest.mock('./on-chain', () => ({ fetchTokenMetadata: jest.fn() }));

it('accepts explicit API misses but rejects partial responses and transport failures', async () => {
  (MavrykToolkit as jest.Mock).mockImplementation(() => ({ rpc: { getChainId: async () => 'known' } }));
  (fetchTokensMetadata as jest.Mock).mockResolvedValueOnce([null]);
  expect(await loadTokensMetadataStrict('rpc', ['KT1test_0'], 'known')).toEqual({ KT1test_0: null });
  (fetchTokensMetadata as jest.Mock).mockResolvedValueOnce([]);
  await expect(loadTokensMetadataStrict('rpc', ['KT1test_0'], 'known')).rejects.toThrow('Incomplete');
  (fetchTokensMetadata as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(loadTokensMetadataStrict('rpc', ['KT1test_0'], 'known')).rejects.toThrow('offline');
});

it('retains custom-chain fetching but never interprets caught on-chain errors as successful misses', async () => {
  (MavrykToolkit as jest.Mock).mockImplementation(() => ({ rpc: { getChainId: async () => 'custom' } }));
  (fetchTokenMetadata as jest.Mock).mockResolvedValueOnce(null);
  await expect(loadTokensMetadataStrict('rpc', ['KT1test_0'], 'custom')).rejects.toThrow();
  (fetchTokenMetadata as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(loadTokensMetadataStrict('rpc', ['KT1test_0'], 'custom')).rejects.toThrow();
  (fetchTokenMetadata as jest.Mock).mockResolvedValueOnce({ decimals: 0, name: 'Valid', symbol: 'V' });
  expect(await loadTokensMetadataStrict('rpc', ['KT1test_0'], 'custom')).toEqual({
    KT1test_0: { decimals: 0, name: 'Valid', symbol: 'V' }
  });
  await expect(loadTokensMetadataStrict('rpc', ['KT1test_0'], 'old-chain')).rejects.toThrow('chain changed');
});
