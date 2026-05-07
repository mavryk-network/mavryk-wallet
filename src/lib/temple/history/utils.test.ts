import { MAV_TOKEN_SLUG } from 'lib/assets';
import type { MavrykHistoryOperation } from 'mavryk/api/history';

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
const { groupMavrykHistoryOperations, mavrykHistoryGroupToHistoryItem } = require('./utils') as typeof import('./utils');
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
    expect(historyItem.displayMoneyDiffs).toEqual([{ assetSlug: MAV_TOKEN_SLUG, diff: '-0.200784' }]);
    expect(historyItem.hideOperationMoneyDiffs).toBe(true);
    expect(historyItem.operations[1].amountSigned).toBe('-200784');
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
