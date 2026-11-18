import BigNumber from 'bignumber.js';

import DELEGATE_OPERATIONS from '../__mocks__/delegateOperations';
import SWAP_OPERATIONS from '../__mocks__/swapOperations';
import TEZ_TRANSFER_OPERATIONS from '../__mocks__/tezTransferOperations';
import { getExpenseReceivers, tryParseExpenses } from '../expenses';

const ACCOUNT = 'mv3AievfzzVPWoQMkXcZTL1JXBiQwF37JyUr';
const CONTRACT = 'KT1DaKxkR1LdnXW1tr7yozdwEAiSQDpCLUBj';

describe('Expenses', () => {
  it('tryParseExpenses mav transfer', async () => {
    const expenses = tryParseExpenses(TEZ_TRANSFER_OPERATIONS, ACCOUNT);

    expect(expenses).toStrictEqual([
      {
        amount: 99000000,
        contractAddress: undefined,
        expenses: [
          {
            amount: new BigNumber('99000000'),
            to: 'mv1MmzUmDpKRTe5rbuqvsD3bBWrewNX58AGX'
          }
        ],
        isEntrypointInteraction: false,
        type: 'transaction'
      }
    ]);
  });

  it('tryParseExpenses delegate', async () => {
    const expenses = tryParseExpenses(DELEGATE_OPERATIONS, ACCOUNT);

    expect(expenses).toStrictEqual([
      {
        amount: 0,
        delegate: 'mv1MmzUmDpKRTe5rbuqvsD3bBWrewNX58AGX',
        expenses: [],
        isEntrypointInteraction: false,
        type: 'delegation'
      }
    ]);
  });

  it('tryParseExpenses swap', async () => {
    const expenses = tryParseExpenses(SWAP_OPERATIONS, ACCOUNT);

    expect(expenses).toStrictEqual([
      {
        amount: 0,
        contractAddress: 'KT1DaKxkR1LdnXW1tr7yozdwEAiSQDpCLUBj',
        expenses: [
          {
            amount: new BigNumber('0'),
            to: 'KT1DaKxkR1LdnXW1tr7yozdwEAiSQDpCLUBj'
          }
        ],
        isEntrypointInteraction: true,
        type: 'update_operators'
      },
      {
        amount: 0,
        contractAddress: 'KT1T2BiwkP5goinYv81pX64kxCR1DUL7yNus',
        expenses: [
          {
            amount: new BigNumber('0'),
            to: 'KT1T2BiwkP5goinYv81pX64kxCR1DUL7yNus'
          }
        ],
        isEntrypointInteraction: true,
        type: 'use'
      },
      {
        amount: 789964,
        contractAddress: 'KT1GdCu6VyfijaARRx5tDPg4ZU2U8uQadBT4',
        expenses: [
          {
            amount: new BigNumber('789964'),
            to: 'KT1GdCu6VyfijaARRx5tDPg4ZU2U8uQadBT4'
          }
        ],
        isEntrypointInteraction: true,
        type: 'use'
      },
      {
        amount: 0,
        contractAddress: 'KT1DaKxkR1LdnXW1tr7yozdwEAiSQDpCLUBj',
        expenses: [
          {
            amount: new BigNumber('0'),
            to: 'KT1DaKxkR1LdnXW1tr7yozdwEAiSQDpCLUBj'
          }
        ],
        isEntrypointInteraction: true,
        type: 'update_operators'
      }
    ]);
  });
  describe('bytes-encoded token recipients', () => {
    const RECIPIENT = 'mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G';
    const RECIPIENT_BYTES = '00003c7d8a2e6a631be1fc109f798af2bb119ce29ee9';

    it('shows an FA1.2 transfer to an optimized (bytes) address', () => {
      const [preview] = tryParseExpenses(
        [
          {
            kind: 'transaction',
            to: CONTRACT,
            amount: 0,
            parameter: {
              entrypoint: 'transfer',
              value: {
                prim: 'Pair',
                args: [
                  { bytes: RECIPIENT_BYTES },
                  { prim: 'Pair', args: [{ bytes: RECIPIENT_BYTES }, { int: '1000000' }] }
                ]
              }
            }
          }
        ] as any,
        ACCOUNT
      );
      expect(preview.expenses).toContainEqual({
        tokenAddress: CONTRACT,
        amount: new BigNumber('1000000'),
        to: RECIPIENT
      });
    });

    it('shows the recipient of an FA2 transfer to a bytes address', () => {
      const [preview] = tryParseExpenses(
        [
          {
            kind: 'transaction',
            to: CONTRACT,
            amount: 0,
            parameter: {
              entrypoint: 'transfer',
              value: [
                {
                  prim: 'Pair',
                  args: [
                    { string: ACCOUNT },
                    [
                      {
                        prim: 'Pair',
                        args: [{ bytes: RECIPIENT_BYTES }, { prim: 'Pair', args: [{ int: '0' }, { int: '5' }] }]
                      }
                    ]
                  ]
                }
              ]
            }
          }
        ] as any,
        ACCOUNT
      );
      expect(preview.expenses).toContainEqual({
        tokenAddress: CONTRACT,
        tokenId: 0,
        amount: new BigNumber('5'),
        to: RECIPIENT
      });
    });
  });

  it('never shows the byte amount of increase_paid_storage as MVRK', () => {
    const [preview] = tryParseExpenses(
      [{ kind: 'increase_paid_storage', amount: '4000000', destination: CONTRACT }] as any,
      ACCOUNT
    );
    expect(preview).toMatchObject({ amount: undefined, expenses: [] });
  });

  describe('origination', () => {
    it('shows the balance of a forged origination as an MVRK expense', () => {
      const [expense] = tryParseExpenses(
        {
          branch: 'BLockGenesisGenesisGenesisGenesisGenesisCCCCCeZiLHU',
          contents: [{ kind: 'origination', source: ACCOUNT, counter: '1', balance: '5000000' }]
        },
        ACCOUNT
      );

      expect(expense.type).toBe('origination');
      expect(expense.amount).toBe(5000000);
      expect(expense.isEntrypointInteraction).toBe(false);
      expect(expense.expenses).toStrictEqual([{ amount: new BigNumber('5000000'), to: undefined }]);
    });

    it('converts the whole-MVRK balance of non-forged origination params to mumav', () => {
      const [expense] = tryParseExpenses([{ kind: 'origination', balance: '5' }], ACCOUNT);

      expect(expense.type).toBe('origination');
      expect(expense.amount).toBe(5000000);
      expect(expense.expenses).toStrictEqual([{ amount: new BigNumber('5000000'), to: undefined }]);
    });

    it('does not let a dApp-supplied counter mark non-forged origination params as mumav', () => {
      const [expense] = tryParseExpenses([{ kind: 'origination', balance: '5000', counter: '1' }], ACCOUNT);

      expect(expense.amount).toBe(5000000000);
      expect(expense.expenses).toStrictEqual([{ amount: new BigNumber('5000000000'), to: undefined }]);
    });

    it('keeps the balance of origination params flagged as mumav', () => {
      const [expense] = tryParseExpenses([{ kind: 'origination', balance: '5000000', mumav: true }], ACCOUNT);

      expect(expense.amount).toBe(5000000);
      expect(expense.expenses).toStrictEqual([{ amount: new BigNumber('5000000'), to: undefined }]);
    });
  });

  describe('entrypoint-derived display type', () => {
    const contractCall = (entrypoint: string, destination: string) => ({
      kind: 'transaction',
      source: ACCOUNT,
      counter: '1',
      amount: '1000000000',
      destination,
      parameters: { entrypoint, value: { prim: 'Unit' } }
    });

    it.each([
      'stake',
      'unstake',
      'finalize_unstake',
      'staking',
      'delegation',
      'delegate',
      'origination',
      'transaction'
    ])('does not label a call to %s on a third-party contract as a protocol operation', entrypoint => {
      const [expense] = tryParseExpenses([contractCall(entrypoint, CONTRACT)], ACCOUNT);

      expect([
        'stake',
        'unstake',
        'finalize_unstake',
        'staking',
        'delegation',
        'origination',
        'transaction'
      ]).not.toContain(expense.type);
      expect(expense.isEntrypointInteraction).toBe(true);
      expect(expense.contractAddress).toBe(CONTRACT);
      expect(expense.expenses).toStrictEqual([{ amount: new BigNumber('1000000000'), to: CONTRACT }]);
    });

    it('keeps the staking label for a stake pseudo-operation to the signing account', () => {
      const [expense] = tryParseExpenses([contractCall('stake', ACCOUNT)], ACCOUNT);

      expect(expense.type).toBe('stake');
    });

    it('keeps the staking label for internal stake params that carry no source', () => {
      const [expense] = tryParseExpenses(
        [{ kind: 'transaction', to: ACCOUNT, amount: 1000000, mumav: true, parameter: { entrypoint: 'unstake' } }],
        ACCOUNT
      );

      expect(expense.type).toBe('unstake');
    });
  });

  describe('%transfer entrypoint with attached MVRK', () => {
    const operation = {
      kind: 'transaction',
      source: ACCOUNT,
      counter: '1',
      amount: '1000000000',
      destination: CONTRACT,
      parameters: {
        entrypoint: 'transfer',
        value: [
          {
            prim: 'Pair',
            args: [
              { string: ACCOUNT },
              [{ prim: 'Pair', args: [{ string: ACCOUNT }, { prim: 'Pair', args: [{ int: '0' }, { int: '0' }] }] }]
            ]
          }
        ]
      }
    };

    it('keeps the contract as the recipient of the MVRK leg', () => {
      const [expense] = tryParseExpenses([operation], ACCOUNT);

      expect(expense.type).toBe('transfer');
      expect(expense.contractAddress).toBe(CONTRACT);
      expect(expense.expenses[0]).toStrictEqual({ amount: new BigNumber('1000000000'), to: CONTRACT });
    });

    it('lists only the contract, not the dApp-chosen recipient of a zero-amount token leg', () => {
      const [expense] = tryParseExpenses([operation], ACCOUNT);

      expect(getExpenseReceivers(expense)).toStrictEqual([CONTRACT]);
    });
  });

  describe('getExpenseReceivers', () => {
    it('drops the zero-amount placeholder leg to the called contract', () => {
      const [expense] = tryParseExpenses(SWAP_OPERATIONS, ACCOUNT);

      expect(getExpenseReceivers(expense)).toStrictEqual([]);
    });

    it('lists the recipient of a plain MVRK transfer', () => {
      const [expense] = tryParseExpenses(TEZ_TRANSFER_OPERATIONS, ACCOUNT);

      expect(getExpenseReceivers(expense)).toStrictEqual(['mv1MmzUmDpKRTe5rbuqvsD3bBWrewNX58AGX']);
    });

    it('keeps the spender of a zero-amount approve, which revokes an allowance', () => {
      expect(
        getExpenseReceivers({
          type: 'approve',
          contractAddress: CONTRACT,
          expenses: [
            { amount: new BigNumber(0), to: CONTRACT },
            { amount: new BigNumber(0), to: ACCOUNT }
          ]
        })
      ).toStrictEqual([ACCOUNT]);
    });

    it('ignores legs without a recipient', () => {
      expect(getExpenseReceivers({ expenses: [{ amount: new BigNumber(5), to: undefined }] })).toStrictEqual([]);
    });
  });
});
