import React from 'react';

import { HistoryComponent } from 'app/templates/History/History';
import { MAV_TOKEN_SLUG } from 'lib/assets';

import { TokenDetailsPopup } from './TokenDetailsPopup';

const { renderToStaticMarkup } = require('react-dom/server.node') as typeof import('react-dom/server');

jest.mock('app/templates/History/History', () => ({ HistoryComponent: jest.fn(() => null) }));
jest.mock('app/templates/PopupModalWithTitle', () => ({
  // Keep children mounted during closing, as react-modal does for its close animation.
  PopupModalWithTitle: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>
}));
jest.mock('app/atoms', () => ({ Alert: () => null, HashChip: () => null, Money: () => null }));
jest.mock('app/atoms/AddBanner', () => ({ DelegatePeriodBanner: () => null }));
jest.mock('app/env', () => ({ useAppEnv: () => ({ popup: true }) }));
jest.mock('app/icons/buy.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/icons/confirmed.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/icons/m_receive.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/icons/m_send.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/icons/m_swap.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/icons/m_withdraw.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/molecules/ButtonRounded', () => ({ ButtonRounded: () => null }));
jest.mock('app/pages/Home/Home', () => ({ ActionButton: () => null, tippyPropsMock: {} }));
jest.mock('app/pages/Stake/DelegateForm', () => ({ DelegateActionsComponent: () => null }));
jest.mock('app/store/tokens-metadata/selectors', () => ({ useTokenMetadataSelector: () => undefined }));
jest.mock('app/templates/AssetIcon', () => ({ AssetIcon: () => null }));
jest.mock('app/templates/BakerBanner', () => ({ __esModule: true, default: () => null }));
jest.mock('app/templates/InFiat', () => ({ __esModule: true, default: () => null }));
jest.mock('lib/balances', () => ({ useBalance: () => ({}) }));
jest.mock('lib/fiat-currency', () => ({
  useAssetFiatCurrencyPrice: () => 0,
  useFiatCurrency: () => ({ selectedFiatCurrency: { symbol: '$' } })
}));
jest.mock('lib/i18n', () => ({ T: () => null, t: (id: string) => id }));
jest.mock('lib/metadata', () => ({ getAssetSymbol: () => 'MVRK' }));
jest.mock('lib/temple/front', () => ({
  useAccount: () => ({ publicKeyHash: 'test-wallet' }),
  useNetwork: () => ({ type: 'test' }),
  useDelegate: () => ({})
}));
jest.mock('lib/woozie', () => ({ navigate: jest.fn(), HistoryAction: {} }));
jest.mock('../../Tokens.module.css', () => ({}));

it.each([
  [MAV_TOKEN_SLUG, true, MAV_TOKEN_SLUG],
  ['', false, MAV_TOKEN_SLUG],
  ['test-contract_42', true, 'test-contract_42']
])('keeps token history scoped for slug %s (open: %s)', (assetSlug, isOpen, expectedSlug) => {
  jest.clearAllMocks();
  renderToStaticMarkup(<TokenDetailsPopup assetSlug={assetSlug} publicKeyHash="test-wallet" isOpen={isOpen} />);
  expect(HistoryComponent).toHaveBeenCalledWith(
    expect.objectContaining({
      assetSlug: expectedSlug,
      tokenAddress: expectedSlug === MAV_TOKEN_SLUG ? 'mv2ZZZZZZZZZZZZZZZZZZZZZZZZZZZDXMF2d' : undefined
    }),
    {}
  );
});
