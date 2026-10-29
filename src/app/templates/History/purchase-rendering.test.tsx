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
let mockFiat = { name: 'USD', symbol: '$' };
let mockFiatRate = 1;
jest.mock('lib/fiat-currency', () => ({
  useFiatCurrency: () => ({ selectedFiatCurrency: mockFiat }),
  useFiatToUsdRate: () => mockFiatRate
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

const { bridgeFixture, BRIDGE_WALLET, BRIDGE_CONTRACT, BRIDGE_TOKEN } =
  require('lib/temple/history/bridge.fixture') as typeof import('lib/temple/history/bridge.fixture');
const bridgeItem = (fixture = bridgeFixture()) =>
  mavrykHistoryGroupToHistoryItem(groupMavrykHistoryOperations([fixture])[0], { address: BRIDGE_WALLET });

it('renders one bridge summary and both priced mint breakdown entries', () => {
  const historyItem = bridgeItem();
  const content = text(<HistoryDetailsPopup historyItem={historyItem} isOpen />)!;
  expect(content.match(/121.8 wUSDT/g)).toHaveLength(1);
  expect(content).toContain('+120.582 wUSDT');
  expect(content).toContain('+1.218 wUSDT');
  expect(content).toContain('+$121.64');
  expect(content).not.toContain('Minted');
  expect(content.match(new RegExp(BRIDGE_TOKEN, 'g'))).toHaveLength(2);
  expect(content).toContain('Called');
  expect(content).toContain(BRIDGE_CONTRACT);
  expect(content).not.toContain(BRIDGE_WALLET);
});

it('keeps partial, missing and self-transfer amounts visible with neutral or unavailable fiat', () => {
  const fixture = bridgeFixture();
  fixture.details!.partialTransfers = true;
  fixture.details!.transfers![0].transferType = 'self';
  fixture.details!.transfers![0].usdAmount = 0;
  delete fixture.details!.transfers![1].amount;
  delete fixture.details!.transfers![1].currency;
  delete fixture.details!.transfers![1].usdAmount;
  const historyItem = bridgeItem(fixture);
  for (const element of [
    <HistoryItem historyItem={historyItem} address={BRIDGE_WALLET} handleItemClick={() => undefined} />,
    <HistoryDetailsPopup historyItem={historyItem} isOpen />
  ]) {
    const content = text(element)!;
    expect(content).toContain('Incomplete breakdown');
    expect(content).toContain('120.582 wUSDT');
    expect(content).not.toContain('+120.582');
    expect(content).toContain('$0');
    expect(content).toContain(`— ${BRIDGE_TOKEN}`);
    expect(content).not.toContain('121.8 wUSDT');
  }
});

it('validates movement IDs without rounding and passes token ID to token history', async () => {
  const { mavrykApi } = require('mavryk/api/client') as typeof import('mavryk/api/client');
  const { fetchTokenHistory } = require('mavryk/api/history') as typeof import('mavryk/api/history');
  const fixture = bridgeFixture();
  fixture.details!.tokenId = '900719925474099312345';
  delete fixture.details!.transfers![1].tokenId;
  fixture.details!.transfers![1].usdAmount = null;
  (mavrykApi.get as jest.Mock).mockResolvedValue({
    data: { walletAddress: BRIDGE_WALLET, operations: [fixture], hasMore: false }
  });
  const response = await fetchTokenHistory(BRIDGE_TOKEN, {
    walletAddress: BRIDGE_WALLET,
    tokenId: '900719925474099312345'
  });
  expect(response.operations[0].details!.tokenId).toBe('900719925474099312345');
  expect(response.operations[0].details!.transfers![1].tokenId).toBeUndefined();
  expect(mavrykApi.get).toHaveBeenLastCalledWith(`/wallets/${BRIDGE_WALLET}/tokens/${BRIDGE_TOKEN}/history`, {
    params: { cursor: undefined, filter: undefined, search: undefined, limit: 20, token_id: '900719925474099312345' }
  });
});

it('converts API USD to selected fiat and distinguishes zero from missing quotes', () => {
  const { MoneyDiffView } = require('./MoneyDiffView') as typeof import('./MoneyDiffView');
  mockFiat = { name: 'EUR', symbol: '€' };
  mockFiatRate = 0.9;
  try {
    const content = text(<MoneyDiffView assetId={BRIDGE_TOKEN} diff="-14" symbol="wUSDT" usdAmount={10} />);
    expect(content).toContain('-€9');
    const zero = text(<MoneyDiffView assetId={BRIDGE_TOKEN} diff="-14" symbol="wUSDT" usdAmount={0} />);
    expect(zero).toContain('€0');
    expect(zero).not.toContain('-€');
    const missing = text(<MoneyDiffView assetId={BRIDGE_TOKEN} diff="-14" symbol="wUSDT" usdAmount={null} />);
    expect(missing).toContain('—');
    expect(missing).not.toContain('€');
  } finally {
    mockFiat = { name: 'USD', symbol: '$' };
    mockFiatRate = 1;
  }
});

it.each(['mint', 'burn'] as const)('renders %s without an empty counterparty label', movementKind => {
  const fixture = bridgeFixture();
  fixture.details = {
    type: 'transfer',
    movementKind,
    tokenAddress: BRIDGE_TOKEN,
    tokenId: '0',
    currency: 'wUSDT',
    amount: 14,
    transferType: movementKind === 'mint' ? 'received' : 'sent'
  };
  const historyItem = bridgeItem(fixture);
  for (const element of [
    <HistoryItem historyItem={historyItem} address={BRIDGE_WALLET} handleItemClick={() => undefined} />,
    <HistoryDetailsPopup historyItem={historyItem} isOpen />
  ]) {
    const content = text(element)!;
    expect(content).toContain(movementKind === 'mint' ? 'Called' : 'Burned');
    if (movementKind === 'mint') {
      expect(content).toContain('mint');
      expect(content).toContain(BRIDGE_TOKEN);
      expect(content).not.toContain('Minted');
    }
    expect(content).toContain(`${movementKind === 'mint' ? '+' : '-'}14 wUSDT`);
    expect(content).not.toContain('Sent to');
    expect(content).not.toContain('Received from');
    expect(content).not.toContain(BRIDGE_WALLET);
  }
});

it.each(['received', 'sent'])('keeps the %s fiat sign when the token amount is unavailable', transferType => {
  const fixture = bridgeFixture();
  fixture.details = { type: 'transfer', tokenAddress: BRIDGE_TOKEN, currency: 'wUSDT', transferType, usdAmount: 10 };
  const historyItem = bridgeItem(fixture);
  const content = text(
    <HistoryItem historyItem={historyItem} address={BRIDGE_WALLET} handleItemClick={() => undefined} />
  );
  expect(content).toContain('— wUSDT');
  expect(content).toContain(`${transferType === 'sent' ? '-' : '+'}$10`);
});

it('hides zero amounts in the row and popup while keeping the operation', () => {
  const fixture = bridgeFixture();
  fixture.details = { type: 'transfer', currency: 'MVRK', amount: 0, usdAmount: null, transferType: 'sent' };
  const historyItem = bridgeItem(fixture);
  for (const element of [
    <HistoryItem historyItem={historyItem} address={BRIDGE_WALLET} handleItemClick={() => undefined} />,
    <HistoryDetailsPopup historyItem={historyItem} isOpen />
  ]) {
    const content = text(element)!;
    expect(content).toContain('Sent');
    // Fee rows keep their signed "-0 MVRK"; only the unsigned zero amount and its fiat line must be gone.
    expect(content).not.toMatch(/(?<!-)0\s+MVRK/);
    expect(content).not.toContain('—');
  }
});
