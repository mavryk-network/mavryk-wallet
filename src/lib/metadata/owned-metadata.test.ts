import { getOwnedUISnapshot } from 'lib/store/zustand/ui-client';
import { TempleChainId } from 'lib/temple/types';

import { getMetadataScopeKey, WHITELIST_METADATA_SCOPE_KEY } from './metadata-scope';
import { getOwnedAssetMetadata } from './owned-metadata';

jest.mock('lib/store/zustand/ui-client', () => ({ getOwnedUISnapshot: jest.fn() }));

const SLUG = 'KT1test_0';
const scope = { account: 'alice', chainId: TempleChainId.Mainnet, networkId: 'mainnet', rpcUrl: 'rpc-a' };
const metadata = (symbol: string) => ({ address: 'KT1test', id: '0', decimals: 0, name: symbol, symbol });

const mockSnapshot = (state: object) => (getOwnedUISnapshot as jest.Mock).mockReturnValue({ metadata: state });

it('prefers scoped records over legacy records over Mainnet whitelist seeds', () => {
  const seeds = { [WHITELIST_METADATA_SCOPE_KEY]: { tokensMetadata: { [SLUG]: metadata('SEED') } } };

  mockSnapshot({ tokensMetadata: {}, scoped: seeds });
  expect(getOwnedAssetMetadata(SLUG, scope)?.symbol).toBe('SEED');
  expect(getOwnedAssetMetadata(SLUG, { ...scope, chainId: 'basenet' })).toBeUndefined();

  mockSnapshot({ tokensMetadata: { [SLUG]: metadata('LEGACY') }, scoped: seeds });
  expect(getOwnedAssetMetadata(SLUG, scope)?.symbol).toBe('LEGACY');

  mockSnapshot({
    tokensMetadata: { [SLUG]: metadata('LEGACY') },
    scoped: { ...seeds, [getMetadataScopeKey(scope)]: { tokensMetadata: { [SLUG]: metadata('SCOPED') } } }
  });
  expect(getOwnedAssetMetadata(SLUG, scope)?.symbol).toBe('SCOPED');
  expect(getOwnedAssetMetadata(SLUG, { ...scope, rpcUrl: 'rpc-b' })?.symbol).toBe('LEGACY');
});

it('checks RWAs before tokens, like useAssetMetadata', () => {
  mockSnapshot({ tokensMetadata: { [SLUG]: metadata('TOKEN') }, rwasMetadata: { [SLUG]: metadata('RWA') } });

  expect(getOwnedAssetMetadata(SLUG, scope)?.symbol).toBe('RWA');
});

it('returns undefined before the owner snapshot is ready', () => {
  (getOwnedUISnapshot as jest.Mock).mockImplementation(() => {
    throw new Error('Await preference migration readiness');
  });

  expect(getOwnedAssetMetadata(SLUG, scope)).toBeUndefined();
});
