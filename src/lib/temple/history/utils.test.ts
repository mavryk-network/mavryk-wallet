import { MAV_TOKEN_SLUG } from 'lib/assets';
import type { MavrykHistoryOperation } from 'mavryk/api/history';

import { refundFixture, REFUND_TOKEN, REFUND_WALLET } from './refund.fixture';

jest.mock('lib/apis/tzkt', () => ({
  isKnownChainId: jest.fn()
}));

jest.mock('lib/i18n', () => ({
  t: jest.fn((id: string) => id)
}));

jest.mock('lib/temple/front/baking/utils', () => ({
  getPredefinedBaker: jest.fn(),
  getPredefinedBakerProperty: jest.fn()
}));

jest.mock('lib/apis/temple', () => ({
  METADATA_API_LOAD_CHUNK_SIZE: 50,
  templeWalletApi: {}
}));

jest.mock('lib/apis/temple/endpoints/templewallet.api', () => ({
  templeWalletApi: {}
}));

jest.mock('../../metadata', () => ({
  useAssetMetadata: jest.fn()
}));

const { buildHistoryMoneyDiffs } = require('./helpers') as typeof import('./helpers');
const { HistoryItemOpTypeEnum } = require('./types') as typeof import('./types');
const { groupMavrykHistoryOperations, mavrykHistoryGroupToHistoryItem } =
  require('./utils') as typeof import('./utils');
const {
  buildHistoryPreviewOperations,
  getHistoryOperationAddress,
  getMultipleInteractionMessageData,
  getMainHistoryOperation
} = require('app/templates/History/utils') as typeof import('app/templates/History/utils');

const ACCOUNT_ADDRESS = 'mv3AievfzzVPWoQMkXcZTL1JXBiQwF37JyUr';
const CONTRACT_ADDRESS = 'KT1DaKxkR1LdnXW1tr7yozdwEAiSQDpCLUBj';
const ALT_CONTRACT_ADDRESS = 'KT1WvrhTmb7mAhm4u47wPS5fXRNNbbUEP6nA';
const RECIPIENT_ADDRESS = 'mv1MmzUmDpKRTe5rbuqvsD3bBWrewNX58AGX';
const OPERATOR_ADDRESS = 'mv2qvHnnx5Wk9CEWp7AJNAA7HpHXk6RkXsy5';

const buildOperation = (overrides: Partial<MavrykHistoryOperation> = {}): MavrykHistoryOperation => ({
  hash: 'opHash',
  type: 'transaction',
  status: 'applied',
  sender: ACCOUNT_ADDRESS,
  target: CONTRACT_ADDRESS,
  ...overrides
});

const buildHistoryItem = (operations: MavrykHistoryOperation[]) => {
  const [group] = groupMavrykHistoryOperations(operations);

  expect(group).toBeDefined();

  return mavrykHistoryGroupToHistoryItem(group!, { address: ACCOUNT_ADDRESS });
};

describe('mavrykHistoryGroupToHistoryItem', () => {
  it('uses normalized backend summary amounts for grouped API interactions', () => {
    const rawNestedOperation = buildOperation({
      amount: 200784,
      target: ALT_CONTRACT_ADDRESS,
      parameter: {
        entrypoint: 'placeSellOrder'
      }
    });
    const updateOperatorsOperation = buildOperation({
      target: CONTRACT_ADDRESS,
      parameter: {
        entrypoint: 'update_operators',
        to: OPERATOR_ADDRESS
      }
    });

    const groupedOperation = buildOperation({
      details: {
        type: 'interaction',
        amount: 0.200784,
        from: ACCOUNT_ADDRESS,
        to: ALT_CONTRACT_ADDRESS,
        currency: 'MVRK',
        entrypoint: 'placeSellOrder'
      },
      operations: [updateOperatorsOperation, rawNestedOperation]
    });

    const historyItem = buildHistoryItem([groupedOperation]);
    const mainOperation = historyItem.mainOperation as Record<string, any> | undefined;

    expect(historyItem.type).toBe(HistoryItemOpTypeEnum.Multiple);
    expect(mainOperation?.entrypoint).toBe('placeSellOrder');
    expect(mainOperation?.destination?.address).toBe(ALT_CONTRACT_ADDRESS);
    expect(historyItem.operations[0].entrypoint).toBe('update_operators');
    expect(historyItem.displayMoneyDiffs).toEqual([{ assetSlug: MAV_TOKEN_SLUG, diff: '-0.200784', symbol: 'MVRK' }]);
    expect(historyItem.hideOperationMoneyDiffs).toBe(true);
    expect(historyItem.operations[1].amountSigned).toBe('-200784');
    expect(buildHistoryMoneyDiffs(historyItem, true)).toEqual([
      { assetSlug: MAV_TOKEN_SLUG, diff: '-0.200784', symbol: 'MVRK' }
    ]);
  });

  it('keeps normalized amounts untouched for simple API history items', () => {
    const operation = buildOperation({
      target: RECIPIENT_ADDRESS,
      details: {
        type: 'transaction',
        transferType: 'sent',
        amount: 0.200784,
        from: ACCOUNT_ADDRESS,
        to: RECIPIENT_ADDRESS,
        currency: 'MVRK',
        entrypoint: 'transfer'
      }
    });

    const historyItem = buildHistoryItem([operation]);

    expect(historyItem.type).toBe(HistoryItemOpTypeEnum.TransferTo);
    expect(historyItem.displayMoneyDiffs).toBeUndefined();
    expect(historyItem.hideOperationMoneyDiffs).toBeUndefined();
    expect(historyItem.operations[0].amountSigned).toBe('-0.200784');
    expect(buildHistoryMoneyDiffs(historyItem, true)).toEqual([{ assetSlug: MAV_TOKEN_SLUG, diff: '-0.200784' }]);
  });

  it('uses top-level transfer details for grouped backend summaries even when the first child is update_operators', () => {
    const rawNestedOperation = buildOperation({
      amount: 200784,
      target: RECIPIENT_ADDRESS,
      parameter: {
        entrypoint: 'transfer',
        to: RECIPIENT_ADDRESS
      }
    });
    const updateOperatorsOperation = buildOperation({
      target: CONTRACT_ADDRESS,
      parameter: {
        entrypoint: 'update_operators',
        to: OPERATOR_ADDRESS
      }
    });

    const groupedOperation = buildOperation({
      details: {
        type: 'transaction',
        transferType: 'sent',
        amount: 0.200784,
        from: ACCOUNT_ADDRESS,
        to: RECIPIENT_ADDRESS,
        currency: 'MVRK',
        entrypoint: 'transfer'
      },
      operations: [updateOperatorsOperation, rawNestedOperation]
    });

    const historyItem = buildHistoryItem([groupedOperation]);
    const mainOperation = historyItem.mainOperation as Record<string, any> | undefined;

    expect(historyItem.type).toBe(HistoryItemOpTypeEnum.TransferTo);
    expect(mainOperation?.type).toBe(HistoryItemOpTypeEnum.TransferTo);
    expect(mainOperation?.destination?.address).toBe(RECIPIENT_ADDRESS);
    expect(historyItem.operations[0].entrypoint).toBe('update_operators');
  });

  it('falls back to child-derived types when grouped summaries do not provide usable top-level details', () => {
    const rawNestedOperation = buildOperation({
      amount: 200784,
      target: ALT_CONTRACT_ADDRESS,
      parameter: {
        entrypoint: 'placeSellOrder'
      }
    });
    const updateOperatorsOperation = buildOperation({
      parameter: {
        entrypoint: 'update_operators',
        to: OPERATOR_ADDRESS
      }
    });

    const groupedOperation = buildOperation({
      operations: [updateOperatorsOperation, rawNestedOperation]
    });

    const historyItem = buildHistoryItem([groupedOperation]);

    expect(historyItem.type).toBe(HistoryItemOpTypeEnum.Multiple);
    expect(historyItem.mainOperation).toBeUndefined();
    expect(historyItem.displayMoneyDiffs).toBeUndefined();
    expect(historyItem.hideOperationMoneyDiffs).toBeUndefined();
    expect(historyItem.operations[0].entrypoint).toBe('update_operators');
  });
});

describe('History UI helpers', () => {
  it('prefers the summary-derived main operation for grouped history previews and addresses', () => {
    const historyItem = buildHistoryItem([
      buildOperation({
        details: {
          type: 'interaction',
          amount: 0.200784,
          from: ACCOUNT_ADDRESS,
          to: ALT_CONTRACT_ADDRESS,
          currency: 'MVRK',
          entrypoint: 'placeSellOrder'
        },
        operations: [
          buildOperation({
            target: CONTRACT_ADDRESS,
            parameter: {
              entrypoint: 'update_operators',
              to: OPERATOR_ADDRESS
            }
          }),
          buildOperation({
            amount: 200784,
            target: ALT_CONTRACT_ADDRESS,
            parameter: {
              entrypoint: 'placeSellOrder'
            }
          })
        ]
      })
    ]);

    const previewOperations = buildHistoryPreviewOperations(historyItem, historyItem.operations, 2);

    expect(getMainHistoryOperation(historyItem)).toEqual(historyItem.mainOperation);
    expect(previewOperations[0].type).toBe(HistoryItemOpTypeEnum.Multiple);
    expect(previewOperations[0].entrypoint).toBe('placeSellOrder');
    expect(previewOperations[1].entrypoint).toBe('update_operators');
    expect(getHistoryOperationAddress(previewOperations[0] as any, historyItem)).toBe(ALT_CONTRACT_ADDRESS);
  });

  it('builds grouped interaction copy from the summary entrypoint and falls back when it is missing', () => {
    const historyItem = buildHistoryItem([
      buildOperation({
        details: {
          type: 'interaction',
          amount: 0.200784,
          from: ACCOUNT_ADDRESS,
          to: ALT_CONTRACT_ADDRESS,
          currency: 'MVRK',
          entrypoint: 'placeSellOrder'
        },
        operations: [
          buildOperation({
            target: CONTRACT_ADDRESS,
            parameter: {
              entrypoint: 'update_operators',
              to: OPERATOR_ADDRESS
            }
          }),
          buildOperation({
            amount: 200784,
            target: ALT_CONTRACT_ADDRESS,
            parameter: {
              entrypoint: 'placeSellOrder'
            }
          })
        ]
      })
    ]);

    const [previewOperation] = buildHistoryPreviewOperations(historyItem, historyItem.operations, 1);
    const multipleMessage = getMultipleInteractionMessageData(previewOperation as any, historyItem);
    const fallbackMessage = getMultipleInteractionMessageData(
      {
        ...(previewOperation as any),
        entrypoint: undefined
      },
      historyItem
    );

    expect(multipleMessage).toEqual({
      entrypoint: 'placeSellOrder',
      contractAddress: ALT_CONTRACT_ADDRESS,
      countLabel: '1 more'
    });
    expect(fallbackMessage).toEqual({
      entrypoint: undefined,
      contractAddress: ALT_CONTRACT_ADDRESS,
      countLabel: '1 more'
    });
    expect(historyItem.operations[0].entrypoint).toBe('update_operators');
  });
});

describe('primary purchases', () => {
  const { purchaseFixture, PURCHASE_WALLET, PURCHASE_ASSET, PAYMENT_ASSET, PURCHASE_DECIMALS } =
    require('./purchase.fixture') as typeof import('./purchase.fixture');
  const normalize = (parent = purchaseFixture(), decimals = PURCHASE_DECIMALS, address = PURCHASE_WALLET) => {
    const context = { address, decimals };
    return mavrykHistoryGroupToHistoryItem(groupMavrykHistoryOperations([parent])[0], context);
  };

  it('retains the observed mint and authoritative payment once, with separate network fees', () => {
    const parent = purchaseFixture();
    const original = JSON.stringify(parent);
    const item = normalize(parent);
    expect(item.type).toBe(HistoryItemOpTypeEnum.Interaction);
    expect(item.hash).toBe(parent.hash);
    expect(item.operations).toHaveLength(4);
    expect(item.status).toBe('applied');
    expect(buildHistoryMoneyDiffs(item)).toEqual([
      { assetSlug: `${PAYMENT_ASSET}_0`, diff: '-6' },
      { assetSlug: `${PURCHASE_ASSET}_0`, diff: '0.2' }
    ]);
    expect(item.operations[1]).toMatchObject({
      entrypoint: 'mint',
      assetSlug: `${PURCHASE_ASSET}_0`,
      amountSigned: '0.2',
      atomicAmount: '200000',
      destination: { address: PURCHASE_WALLET }
    });
    expect(item.mainOperation?.networkFees?.totalFee).toBe(0.010438);
    expect(getHistoryOperationAddress(item.mainOperation)).toBe(parent.details!.contract);
    expect(item.hideOperationMoneyDiffs).toBe(true);
    expect(JSON.stringify(parent)).toBe(original);
  });

  it('normalizes all wallet allocations and IDs using distinct decimals without losing precision', () => {
    const parent = purchaseFixture();
    parent.operations![1].parameter!.value = [
      { owner: PURCHASE_WALLET, amount: '123456789012345678901', token_id: '1' },
      { owner: PURCHASE_WALLET, amount: '2', token_id: '1' },
      { owner: PURCHASE_WALLET, amount: '35', token_id: '2' },
      { owner: 'another-owner', amount: '999999', token_id: '2' }
    ];
    const item = normalize(parent, { [`${PURCHASE_ASSET}_1`]: 18, [`${PURCHASE_ASSET}_2`]: 1 });
    expect(item.displayMoneyDiffs).toEqual([
      { assetSlug: `${PAYMENT_ASSET}_0`, diff: '-6' },
      { assetSlug: `${PURCHASE_ASSET}_1`, diff: '123.456789012345678903' },
      { assetSlug: `${PURCHASE_ASSET}_2`, diff: '3.5' }
    ]);
  });

  it('deduplicates repeated children, retaining distinct split payment operations', () => {
    const parent = purchaseFixture();
    parent.operations!.push(...parent.operations!);
    expect(normalize(parent).displayMoneyDiffs).toEqual(normalize().displayMoneyDiffs);
    expect(normalize(parent).operations).toHaveLength(4);
  });

  it('hides missing decimals and keeps mint identity and raw quantity', () => {
    const item = normalize(purchaseFixture(), {});
    expect(item.displayMoneyDiffs).toEqual([{ assetSlug: `${PAYMENT_ASSET}_0`, diff: '-6' }]);
    expect(item.operations[1]).toMatchObject({
      assetSlug: `${PURCHASE_ASSET}_0`,
      atomicAmount: '200000',
      isAmountUnavailable: true
    });
    expect(item.operations[1].amountDiff).toBeUndefined();
  });

  it.each(['failed', 'backtracked', 'skipped', 'pending'])('does not settle a %s parent or child', status => {
    for (const failParent of [true, false]) {
      const parent = purchaseFixture();
      (failParent ? parent : parent.operations![1]).status = status;
      const item = normalize(parent);
      expect(item.status).toBe(status);
      expect(buildHistoryMoneyDiffs(item, true)).toEqual([]);
      expect(item.operations[1].amountDiff).toBeUndefined();
    }
  });

  it('uses actual split transfers when the payment summary is missing, never the purchase limit', () => {
    const parent = purchaseFixture();
    delete parent.details!.amount;
    delete parent.amount;
    expect(normalize(parent).displayMoneyDiffs).toEqual([
      { assetSlug: `${PURCHASE_ASSET}_0`, diff: '0.2' },
      { assetSlug: `${PAYMENT_ASSET}_0`, diff: '-6' }
    ]);
  });

  it('includes incoming refunds without adding outgoing payment children twice', () => {
    const parent = purchaseFixture();
    parent.operations!.push({
      ...parent.operations![2],
      id: 999,
      parameter: {
        entrypoint: 'transfer',
        value: [{ from_: 'seller', txs: [{ to_: PURCHASE_WALLET, amount: '1000000', token_id: '0' }] }]
      }
    });
    expect(normalize(parent).displayMoneyDiffs).toContainEqual({ assetSlug: `${PAYMENT_ASSET}_0`, diff: '-5' });
  });

  it('does not attribute another buyer payment or mint to the viewed account', () => {
    expect(normalize(purchaseFixture(), PURCHASE_DECIMALS, 'unrelated-wallet').displayMoneyDiffs).toEqual([]);
  });

  it('does not depend on the example hash or currency label', () => {
    const parent = purchaseFixture();
    parent.hash = 'different-hash';
    parent.details!.currency = 'OTHER';
    parent.operations!.forEach(operation => {
      operation.hash = parent.hash;
    });
    expect(normalize(parent).displayMoneyDiffs).toEqual(normalize().displayMoneyDiffs);
  });

  it('deduplicates child IDs returned with a different role', () => {
    const parent = purchaseFixture();
    parent.operations!.push({ ...parent.operations![1], role: 'recipient' });
    expect(normalize(parent).displayMoneyDiffs).toEqual(normalize().displayMoneyDiffs);
  });

  it('aggregates fallback payments by exact token ID and recipient', () => {
    const parent = purchaseFixture();
    delete parent.details!.amount;
    delete parent.amount;
    parent.operations![2].parameter!.value = [
      {
        from_: PURCHASE_WALLET,
        txs: [
          { to_: 'seller', amount: '1200', token_id: '1' },
          { to_: 'fee-recipient', amount: '300', token_id: '1' },
          { to_: PURCHASE_WALLET, amount: '9000', token_id: '1' }
        ]
      }
    ];
    const result = normalize(parent, { ...PURCHASE_DECIMALS, [`${PAYMENT_ASSET}_1`]: 2 });
    expect(result.displayMoneyDiffs).toContainEqual({ assetSlug: `${PAYMENT_ASSET}_1`, diff: '-15' });
    expect(result.displayMoneyDiffs).toContainEqual({ assetSlug: `${PAYMENT_ASSET}_0`, diff: '-0.06' });
  });

  it.each([
    null,
    [{ owner: PURCHASE_WALLET, amount: '-1', token_id: '0' }],
    [{ owner: PURCHASE_WALLET, amount: 9007199254740992, token_id: '0' }]
  ])('preserves the interaction for unsupported mint parameters', value => {
    const parent = purchaseFixture();
    parent.operations![1].parameter!.value = value;
    expect(normalize(parent).displayMoneyDiffs).toEqual([{ assetSlug: `${PAYMENT_ASSET}_0`, diff: '-6' }]);
    expect(normalize(parent).operations[1].entrypoint).toBe('mint');
  });
});

describe('interaction amounts', () => {
  const normalize = (operation = refundFixture(), decimals: Record<string, number> = {}) =>
    mavrykHistoryGroupToHistoryItem(groupMavrykHistoryOperations([operation])[0], {
      address: REFUND_WALLET,
      decimals
    });

  it.each([4.26, 4.5, 0, '123456789.123456789'])('prefers API display amount %s over atomic quantities', amount => {
    const operation = refundFixture();
    operation.details!.amount = amount;
    expect(buildHistoryMoneyDiffs(normalize(operation), true)).toEqual([
      { assetSlug: `${REFUND_TOKEN}_0`, diff: String(amount), symbol: 'OCEAN' }
    ]);
  });

  it('does not require rawAmount when the API supplies amount', () => {
    const operation = refundFixture();
    delete operation.details!.rawAmount;
    expect(normalize(operation).displayMoneyDiffs).toEqual([
      { assetSlug: `${REFUND_TOKEN}_0`, diff: '4.26', symbol: 'OCEAN' }
    ]);
  });

  it.each([0, 6, 8])('uses actual token decimals %s only when the display amount is absent', decimals => {
    const operation = refundFixture();
    delete operation.details!.amount;
    const result = normalize(operation, { [`${REFUND_TOKEN}_0`]: decimals });
    expect(result.displayMoneyDiffs?.[0].diff).toBe(String(4260000 / 10 ** decimals));
    expect(normalize(operation).displayMoneyDiffs).toEqual([]);
  });

  it('supports ungrouped interactions and outgoing signs', () => {
    const operation = refundFixture();
    delete operation.operations;
    operation.details!.from = REFUND_WALLET;
    operation.details!.transferType = 'sent';
    expect(normalize(operation).displayMoneyDiffs).toEqual([
      { assetSlug: `${REFUND_TOKEN}_0`, diff: '-4.26', symbol: 'OCEAN' }
    ]);
  });
});
