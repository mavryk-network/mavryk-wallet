import type { MavrykHistoryAction, MavrykHistoryOperation } from 'mavryk/api/history';

import type { UserHistoryItem } from './types';

jest.mock('mavryk/api/client', () => ({ mavrykApi: { get: jest.fn() } }));
jest.mock('lib/apis/tzkt', () => ({ isKnownChainId: jest.fn() }));
jest.mock('lib/i18n', () => ({ t: jest.fn((id: string) => id) }));
jest.mock('lib/temple/front/baking/utils', () => ({
  getPredefinedBaker: jest.fn(),
  getPredefinedBakerProperty: jest.fn()
}));
jest.mock('lib/apis/temple', () => ({ METADATA_API_LOAD_CHUNK_SIZE: 50, templeWalletApi: {} }));
jest.mock('lib/apis/temple/endpoints/templewallet.api', () => ({ templeWalletApi: {} }));
jest.mock('../../metadata', () => ({ useAssetMetadata: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({ getOwnedUISnapshot: jest.fn() }));

const { parseHistoryResponse } = require('mavryk/api/history') as typeof import('mavryk/api/history');
const { deriveHistoryNetworkFeePayer, summarizeHistoryActions } = require('./actions') as typeof import('./actions');
const { mergeHistoryPage } = require('./merge') as typeof import('./merge');
const { groupMavrykHistoryOperations, mavrykHistoryGroupToHistoryItem } =
  require('./utils') as typeof import('./utils');

const WALLET = 'mv1SSjCEsX5DCSha29oTqj4qvqWZTodRErgN';
const RELAYER = 'mv1GvRGzZJjCKsZziwVNpy7CLVGXpST8bSyD';
const MARKET = 'KT1BjnZec6FGSm3g2ZnDmL7dGfBQTj4yy4yh';
const WUSDT = 'KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v';
const RWA = 'KT1UqpQV34HZ2iGBxHtPKtdriwenu83Zy7mS';

const buildAction = (overrides: Partial<MavrykHistoryAction> = {}): MavrykHistoryAction => ({
  id: 'order:hash:1:-1:market:buy:1321:0',
  kind: 'place_buy_order',
  participant: WALLET,
  sender: RELAYER,
  executionMode: 'permit',
  networkFeePayer: RELAYER,
  orderId: '1321',
  orderSide: 'buy',
  ...overrides
});

const buildPermitGroup = (actions: MavrykHistoryAction[], hash = 'opPermit'): MavrykHistoryOperation => ({
  hash,
  type: 'interaction',
  status: 'applied',
  details: {
    type: 'interaction',
    transferType: 'sent',
    from: WALLET,
    to: MARKET,
    tokenAddress: WUSDT,
    tokenId: '0',
    rawAmount: '22000000',
    amount: 22,
    currency: 'wUSDT',
    entrypoint: 'permitAndExecute',
    actions,
    transfers: [
      {
        type: 'transfer',
        transferType: 'sent',
        from: WALLET,
        to: MARKET,
        tokenAddress: WUSDT,
        tokenId: '0',
        rawAmount: '22000000',
        amount: 22,
        currency: 'wUSDT'
      }
    ]
  },
  networkFees: { totalFee: 0.055251, gasFee: 0.003501, storageFee: 0.05175, burnedFromFees: 0.05175 },
  operationsCount: 2,
  operations: [
    { id: 1, hash, type: 'interaction', role: 'utility', sender: RELAYER, target: MARKET, status: 'applied' },
    { id: 2, hash, type: 'interaction', role: 'internal', sender: MARKET, target: MARKET, status: 'applied' }
  ]
});

const toItems = (operations: MavrykHistoryOperation[]) =>
  groupMavrykHistoryOperations(operations, { preserveTopLevelGroups: true }).map(group =>
    mavrykHistoryGroupToHistoryItem(group, { address: WALLET })
  );

describe('history action parsing', () => {
  it('keeps unknown kinds, signed raw deltas and unknown enrichment status; drops malformed actions only', () => {
    const response = parseHistoryResponse({
      walletAddress: WALLET,
      hasMore: false,
      equiteezHistory: { status: 'reindexing' },
      operations: [
        buildPermitGroup([
          buildAction({ kind: 'future_kind', rawPayment: '-221000' } as Partial<MavrykHistoryAction>),
          { kind: 'missing_id' } as unknown as MavrykHistoryAction,
          buildAction({ id: 'second', counter: 0, nonce: 0 } as Partial<MavrykHistoryAction>)
        ])
      ]
    });

    expect(response.equiteezHistory?.status).toBe('unknown');
    expect(response.operations[0].operationsCount).toBe(2);
    expect(response.operations[0].details?.actions?.map(action => action.kind)).toEqual([
      'future_kind',
      'place_buy_order'
    ]);
    expect(response.operations[0].details?.actions?.[0].rawPayment).toBe('-221000');
  });

  it('rejects a non-integer cursor', () => {
    expect(() => parseHistoryResponse({ walletAddress: WALLET, operations: [], hasMore: true, cursor: 1.5 })).toThrow();
  });
});

describe('history groups and identity', () => {
  it('keeps two returned groups that share a hash as separate cards', () => {
    const transfer = (tokenAddress: string, rawAmount: string): MavrykHistoryOperation => ({
      hash: 'ooShared',
      type: 'transfer',
      status: 'applied',
      details: { type: 'transfer', transferType: 'received', from: MARKET, to: WALLET, tokenAddress, rawAmount }
    });
    const items = toItems([transfer(WUSDT, '85140000'), transfer(RWA, '1960000')]);

    expect(items).toHaveLength(2);
    expect(new Set(items.map(item => item.id)).size).toBe(2);
    expect(items.every(item => item.hash === 'ooShared')).toBe(true);
  });

  it('still merges flat hash siblings without summaries (legacy/pending input)', () => {
    const child = (id: number): MavrykHistoryOperation => ({
      id,
      hash: 'opFlat',
      type: 'transaction',
      status: 'applied'
    });

    expect(groupMavrykHistoryOperations([child(1), child(2)], { preserveTopLevelGroups: true })).toHaveLength(1);
  });

  it('carries deduplicated actions, gasless flag and the relayer as another fee payer', () => {
    const action = buildAction();
    const [item] = toItems([buildPermitGroup([action, action])]);

    expect(item.actions).toEqual([action]);
    expect(item.isGasless).toBe(true);
    expect(item.operationsCount).toBe(2);
    expect(item.networkFeePayer).toEqual({ kind: 'other', address: RELAYER });
  });

  it('does not infer actions or a payer from permitAndExecute alone', () => {
    const [item] = toItems([buildPermitGroup([])]);

    expect(item.actions).toBeUndefined();
    expect(item.isGasless).toBeUndefined();
    expect(item.networkFeePayer).toBeUndefined();
  });
});

describe('deriveHistoryNetworkFeePayer', () => {
  const children = (sender: string): MavrykHistoryOperation[] => [
    { hash: 'h', type: 'interaction', status: 'applied', sender },
    { hash: 'h', type: 'transfer', status: 'applied', sender: MARKET }
  ];

  it('attributes the wallet on complete direct evidence', () => {
    const action = buildAction({ executionMode: 'direct', networkFeePayer: WALLET });

    expect(deriveHistoryNetworkFeePayer([action], children(WALLET), 2, WALLET)).toEqual({ kind: 'wallet' });
  });

  it('is mixed for differing payers, a capped preview, or a child signed by someone else', () => {
    const relayed = buildAction();
    const direct = buildAction({ id: 'b', networkFeePayer: WALLET });

    expect(deriveHistoryNetworkFeePayer([relayed, direct], children(RELAYER), 2, WALLET)).toEqual({ kind: 'mixed' });
    expect(deriveHistoryNetworkFeePayer([relayed], children(RELAYER), 25, WALLET)).toEqual({ kind: 'mixed' });
    expect(deriveHistoryNetworkFeePayer([relayed], children(WALLET), 2, WALLET)).toEqual({ kind: 'mixed' });
  });

  it('is undefined without supported actions', () => {
    expect(deriveHistoryNetworkFeePayer([buildAction({ kind: 'future' })], [], undefined, WALLET)).toBeUndefined();
  });
});

describe('summarizeHistoryActions', () => {
  it('collapses repeated kinds and keeps a single order ID', () => {
    const refund = (id: string) => buildAction({ id, kind: 'refund_order', orderId: id });

    expect(summarizeHistoryActions([buildAction(), refund('1'), refund('2'), refund('3')])).toEqual([
      { kind: 'place_buy_order', label: 'BUY order placed', count: 1, orderId: '1321' },
      { kind: 'refund_order', label: 'Order refund', count: 3, orderId: undefined }
    ]);
  });
});

describe('mergeHistoryPage', () => {
  const item = (id: string, hash: string, status: UserHistoryItem['status'] = 'applied') =>
    ({ id, hash, status } as UserHistoryItem);

  it('replaces cards by identity, keeps same-hash siblings and retires confirmed pending cards', () => {
    const previous = [item('pending', 'h1', 'pending'), item('h2#a', 'h2')];
    const page = [item('h1#a', 'h1'), item('h1#b', 'h1'), item('h2#a', 'h2', 'failed')];
    const { items, addedCount } = mergeHistoryPage(previous, page);

    expect(items.map(({ id, status }) => [id, status])).toEqual([
      ['h2#a', 'failed'],
      ['h1#a', 'applied'],
      ['h1#b', 'applied']
    ]);
    expect(addedCount).toBe(2);
  });

  it('reports zero new cards for an already-known page', () => {
    const previous = [item('a', 'h')];

    expect(mergeHistoryPage(previous, previous).addedCount).toBe(0);
  });
});
