import React from 'react';

import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useAccountRwasSelector } from 'app/store/assets/selectors';
import { TempleChainId } from 'lib/temple/types';

import { useEnabledAccountRwaSlugs } from './rwas';
import { useEnabledAccountTokensSlugs } from './tokens';

jest.mock('app/store/assets/utils', () => ({}));
jest.mock('app/store/assets/selectors', () => ({
  useAccountTokensSelector: () => ({ retained: { status: 'enabled' }, regular: { status: 'enabled' } }),
  useAccountRwasSelector: jest.fn(),
  useMainnetTokensWhitelistSelector: () => ['retained', 'whitelisted']
}));
jest.mock('app/store/balances/selectors', () => ({
  useAllAccountBalancesSelector: () => ({ retained: '10', regular: '10', whitelisted: '10' })
}));
jest.mock('app/store/tokens-metadata/selectors', () => ({ useAllTokensMetadataSelector: () => ({}) }));
jest.mock('lib/temple/front', () => ({
  useAccount: () => ({ publicKeyHash: 'alice' }),
  useChainId: () => require('lib/temple/types').TempleChainId.Mainnet
}));
jest.mock('../known-tokens', () => ({ PREDEFINED_TOKENS_METADATA: {} }));
jest.mock('./collectibles', () => ({ useAccountCollectibles: () => [] }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('reactively excludes retained and whitelisted RWAs from Tokens, including hidden RWAs', () => {
  const root = createRoot(document.createElement('div'));
  let tokens: string[] = [];
  let rwas: string[] = [];
  function Consumer() {
    tokens = useEnabledAccountTokensSlugs(true);
    rwas = useEnabledAccountRwaSlugs();
    return null;
  }
  (useAccountRwasSelector as jest.Mock).mockReturnValue({});
  act(() => root.render(<Consumer />));
  expect(tokens).toEqual(expect.arrayContaining(['retained', 'regular', 'whitelisted']));
  (useAccountRwasSelector as jest.Mock).mockReturnValue({
    retained: { status: 'enabled' },
    whitelisted: { status: 'removed' }
  });
  act(() => root.render(<Consumer />));
  expect(useAccountRwasSelector).toHaveBeenCalledWith('alice', TempleChainId.Mainnet);
  expect(tokens).toEqual(['regular']);
  expect(rwas).toEqual(['retained']);
  act(() => root.unmount());
});
