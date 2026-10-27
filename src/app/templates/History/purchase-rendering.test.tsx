import React from 'react';

import { MAV_TOKEN_SLUG } from 'lib/assets';
import {
  PURCHASE_ASSET,
  PAYMENT_ASSET,
  PURCHASE_WALLET,
  PURCHASE_DECIMALS,
  purchaseFixture
} from 'lib/temple/history/purchase.fixture';
import { refundFixture, REFUND_TOKEN, REFUND_WALLET } from 'lib/temple/history/refund.fixture';
import { groupMavrykHistoryOperations, mavrykHistoryGroupToHistoryItem } from 'lib/temple/history/utils';

import { HistoryDetailsPopup } from './HistoryDetailsPopup';
import { HistoryItem } from './HistoryItem';
import { getAssetsFromOperations } from './utils';

const { renderToStaticMarkup } = require('react-dom/server.node') as typeof import('react-dom/server');

jest.mock('lib/apis/tzkt', () => ({ isKnownChainId: jest.fn() }));
jest.mock('lib/apis/temple', () => ({ METADATA_API_LOAD_CHUNK_SIZE: 50, templeWalletApi: {} }));
jest.mock('lib/apis/temple/endpoints/templewallet.api', () => ({ templeWalletApi: {} }));
jest.mock('lib/temple/front', () => ({ useAccount: () => ({ publicKeyHash: PURCHASE_WALLET }) }));
jest.mock('lib/temple/front/baking/utils', () => ({
  getPredefinedBaker: jest.fn(),
  getPredefinedBakerProperty: jest.fn()
}));
jest.mock('lib/i18n', () => ({
  t: (id: string) => id,
  T: ({ id, substitutions }: { id: string; substitutions?: React.ReactNode }) => (
    <span>
      {id}
      {substitutions}
    </span>
  )
}));
jest.mock('app/env', () => ({ useAppEnv: () => ({ popup: true }) }));
jest.mock('./history.module.css', () => ({}));
jest.mock('app/icons/chevron-down.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/icons/parallel-opposing-arrows.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/atoms', () => ({
  Divider: () => null,
  Identicon: () => null,
  HashChip: ({ hash }: { hash: string }) => <span>{hash}</span>,
  Money: ({ children }: { children: unknown }) => <span>{String(children)}</span>
}));
jest.mock('app/atoms/Money', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => <span>{String(children)}</span>
}));
jest.mock('app/atoms/Divider', () => ({ ListItemDivider: () => null }));
jest.mock('app/atoms/CardContainer', () => ({
  CardContainer: ({ children }: React.PropsWithChildren<{}>) => <div>{children}</div>
}));
jest.mock('app/templates/PopupModalWithTitle', () => ({
  PopupModalWithTitle: ({ title, children }: React.PropsWithChildren<{ title: React.ReactNode }>) => (
    <div>
      {title}
      {children}
    </div>
  )
}));
jest.mock('app/templates/InFiat', () => ({ __esModule: true, default: () => null }));
jest.mock('app/pages/Home/OtherComponents/Tokens/components/Balance', () => ({ FiatBalance: () => null }));
jest.mock('../AssetImage', () => ({ AssetImage: () => null }));
jest.mock('../OpenInExplorerChip', () => ({ OpenInExplorerChip: () => null }));
jest.mock('./HistoryTime', () => ({ HistoryTime: () => null }));
jest.mock('./HistoryTokenIcon', () => ({ HistoryTokenIcon: () => null, AssetIconPlaceholder: () => null }));
jest.mock('lib/metadata', () => ({
  useAssetMetadata: (slug: string) =>
    slug === `${REFUND_TOKEN}_0`
      ? undefined
      : {
          decimals: 6,
          symbol: slug === MAV_TOKEN_SLUG ? 'MVRK' : slug.startsWith(PURCHASE_ASSET) ? 'KRKN' : 'wUSDT'
        },
  getAssetSymbol: (metadata: { symbol: string }) => metadata.symbol,
  useMultipleAssetsMetadata: () => []
}));

const item = (decimals: Record<string, number> = PURCHASE_DECIMALS) =>
  mavrykHistoryGroupToHistoryItem(groupMavrykHistoryOperations([purchaseFixture()])[0], {
    address: PURCHASE_WALLET,
    decimals
  });
const text = (element: React.ReactElement) => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(element);
  return container.textContent;
};

it('shows both display-unit movements in the compact row and details popup', () => {
  const historyItem = item();
  for (const element of [
    <HistoryItem historyItem={historyItem} address={PURCHASE_WALLET} handleItemClick={() => undefined} />,
    <HistoryDetailsPopup historyItem={historyItem} isOpen />
  ]) {
    const content = text(element);
    expect(content).toContain('+0.2 KRKN');
    expect(content).toContain('-6 wUSDT');
    expect(content).not.toContain('200000');
  }
  const popup = text(<HistoryDetailsPopup historyItem={historyItem} isOpen />);
  expect(popup).toContain('-0.010438 MVRK');
  expect(popup).not.toContain('#0');
  expect(popup).not.toContain(PURCHASE_WALLET);
  expect(getAssetsFromOperations(historyItem)).toEqual([`${PAYMENT_ASSET}_0`, `${PURCHASE_ASSET}_0`]);
});

it('hides unknown amounts and the token ID/recipient line while retaining the mint contract', () => {
  const historyItem = item({});
  const content = text(<HistoryDetailsPopup historyItem={historyItem} isOpen />);
  expect(content).not.toContain('200000');
  expect(content).not.toContain('+0.2');
  expect(content).toContain('-6 wUSDT');
  expect(content).toContain(PURCHASE_ASSET);
  expect(content).not.toContain(PURCHASE_WALLET);
  expect(content).not.toContain('#0');
  expect(getAssetsFromOperations(historyItem)).toContain(`${PURCHASE_ASSET}_0`);
});

it.each([true, false])(
  'renders API refund amount and symbol without metadata (transfer direction: %s)',
  hasDirection => {
    const fixture = refundFixture();
    if (!hasDirection) delete fixture.details!.transferType;
    const historyItem = mavrykHistoryGroupToHistoryItem(groupMavrykHistoryOperations([fixture])[0], {
      address: REFUND_WALLET
    });
    for (const element of [
      <HistoryItem historyItem={historyItem} address={REFUND_WALLET} handleItemClick={() => undefined} />,
      <HistoryDetailsPopup historyItem={historyItem} isOpen />
    ]) {
      const content = text(element);
      expect(content).toContain('+4.26 OCEAN');
      expect(content).not.toContain('4260000');
    }
  }
);

jest.mock('mavryk/api/client', () => ({ mavrykApi: { get: jest.fn() } }));

it('preserves the refund amount through API validation, fetching and rendering', async () => {
  const { mavrykApi } = require('mavryk/api/client') as typeof import('mavryk/api/client');
  const { fetchUserOperationByHash } = require('lib/temple/history/fetch') as typeof import('lib/temple/history/fetch');
  const { TempleChainId } = require('lib/temple/types') as typeof import('lib/temple/types');
  const operation = refundFixture();
  const response = {
    walletAddress: REFUND_WALLET,
    operations: [{ ...operation, details: { ...operation.details, tokenId: '0' } }],
    hasMore: false
  };
  (mavrykApi.get as jest.Mock).mockResolvedValue({
    data: response
  });
  const [historyItem] = await fetchUserOperationByHash(TempleChainId.Basenet, REFUND_WALLET, operation.hash);
  expect(historyItem).toBeDefined();
  for (const element of [
    <HistoryItem historyItem={historyItem} address={REFUND_WALLET} handleItemClick={() => undefined} />,
    <HistoryDetailsPopup historyItem={historyItem} isOpen />
  ]) {
    expect(text(element)).toContain('+4.26 OCEAN');
  }
});
