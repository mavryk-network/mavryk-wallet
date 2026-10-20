import React from 'react';

import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useAccountRwasSelector } from 'app/store/assets/selectors';
import { TempleChainId } from 'lib/temple/types';

import { useAccountTokens } from './tokens';

jest.mock('app/store/assets/selectors', () => ({
  useAccountTokensSelector: () => ({ regular_0: { status: 'enabled' }, rwa_0: { status: 'enabled' } }),
  useAccountRwasSelector: jest.fn(),
  useMainnetTokensWhitelistSelector: () => ['rwa_0']
}));
jest.mock('app/store/balances/selectors', () => ({
  useAllAccountBalancesSelector: () => ({ regular_0: '1', rwa_0: '2' })
}));
jest.mock('app/store/tokens-metadata/selectors', () => ({ useAllTokensMetadataSelector: () => ({}) }));
jest.mock('lib/assets/known-tokens', () => ({ PREDEFINED_TOKENS_METADATA: {} }));
jest.mock('lib/temple/front', () => ({}));
jest.mock('app/store/assets/utils', () => ({}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('does not reintroduce owner-classified RWAs through retained token or whitelist sources', async () => {
  (useAccountRwasSelector as jest.Mock).mockReturnValue({ rwa_0: { status: 'disabled' } });
  const root = createRoot(document.createElement('div'));
  let tokens: ReturnType<typeof useAccountTokens> = [];
  function Consumer() {
    tokens = useAccountTokens('alice', TempleChainId.Mainnet);
    return null;
  }
  await act(async () => root.render(<Consumer />));
  expect(tokens.map(token => token.slug)).toEqual(['regular_0']);
  (useAccountRwasSelector as jest.Mock).mockReturnValue({});
  await act(async () => root.render(<Consumer />));
  expect(tokens.map(token => token.slug)).toContain('rwa_0');
  await act(async () => root.unmount());
});
