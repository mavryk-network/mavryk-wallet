import { MAV_TOKEN_SLUG } from 'lib/assets';
import type { MavrykHistoryOperation } from 'mavryk/api/history';

jest.mock('lib/apis/tzkt', () => ({
  isKnownChainId: jest.fn()
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
const { groupMavrykHistoryOperations, mavrykHistoryGroupToHistoryItem } = require('./utils') as typeof import('./utils');

const ACCOUNT_ADDRESS = 'mv3AievfzzVPWoQMkXcZTL1JXBiQwF37JyUr';
const CONTRACT_ADDRESS = 'KT1DaKxkR1LdnXW1tr7yozdwEAiSQDpCLUBj';
const RECIPIENT_ADDRESS = 'mv1MmzUmDpKRTe5rbuqvsD3bBWrewNX58AGX';

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
      parameter: {
        entrypoint: 'placeSellOrder'
      }
    });

    const groupedOperation = buildOperation({
      details: {
        type: 'interaction',
        amount: 0.200784,
        from: ACCOUNT_ADDRESS,
        to: CONTRACT_ADDRESS,
        currency: 'MVRK',
        entrypoint: 'placeSellOrder'
      },
      operations: [rawNestedOperation]
    });

    const historyItem = buildHistoryItem([groupedOperation]);

    expect(historyItem.type).toBe(HistoryItemOpTypeEnum.Multiple);
    expect(historyItem.displayMoneyDiffs).toEqual([{ assetSlug: MAV_TOKEN_SLUG, diff: '-0.200784' }]);
    expect(historyItem.hideOperationMoneyDiffs).toBe(true);
    expect(historyItem.operations[0].amountSigned).toBe('-200784');
    expect(buildHistoryMoneyDiffs(historyItem, true)).toEqual([{ assetSlug: MAV_TOKEN_SLUG, diff: '-0.200784' }]);
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

  it('falls back to child-derived amounts when grouped summaries do not provide a normalized amount', () => {
    const rawNestedOperation = buildOperation({
      amount: 200784,
      parameter: {
        entrypoint: 'placeSellOrder'
      }
    });

    const groupedOperation = buildOperation({
      details: {
        type: 'interaction',
        from: ACCOUNT_ADDRESS,
        to: CONTRACT_ADDRESS,
        currency: 'MVRK',
        entrypoint: 'placeSellOrder'
      },
      operations: [rawNestedOperation]
    });

    const historyItem = buildHistoryItem([groupedOperation]);

    expect(historyItem.type).toBe(HistoryItemOpTypeEnum.Multiple);
    expect(historyItem.displayMoneyDiffs).toBeUndefined();
    expect(historyItem.hideOperationMoneyDiffs).toBeUndefined();
    expect(historyItem.operations[0].amountSigned).toBe('-200784');
    expect(buildHistoryMoneyDiffs(historyItem, true)).toEqual([{ assetSlug: MAV_TOKEN_SLUG, diff: '-200784' }]);
  });
});
