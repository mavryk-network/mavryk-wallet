import { buildFinalOpParmas, validateOpParams } from './dryrun';

const ACCOUNT_ADDRESS = 'mv1N3KY1vXdYX2x568MGmNBRLEK7k7uc2zEM';
const CONTRACT_ADDRESS = 'KT1EyH6KR9STvgiet4ahrtBf7WCnmJovvJa1';

describe('operation parameter validation', () => {
  it('accepts compatible operation params', () => {
    expect(() =>
      validateOpParams([
        {
          kind: 'transaction',
          to: ACCOUNT_ADDRESS,
          amount: 1,
          fee: '123',
          gasLimit: 1000,
          storageLimit: '0',
          parameter: { entrypoint: 'default', value: { prim: 'Unit' } }
        },
        {
          kind: 'delegation',
          delegate: ACCOUNT_ADDRESS
        },
        {
          kind: 'origination',
          balance: '0',
          script: {
            code: [],
            storage: { prim: 'Unit' }
          }
        },
        {
          kind: 'stake',
          amount: 2
        },
        {
          kind: 'unstake',
          amount: '2'
        },
        {
          kind: 'finalize_unstake'
        },
        {
          kind: 'increase_paid_storage',
          amount: 1,
          destination: CONTRACT_ADDRESS
        }
      ])
    ).not.toThrow();
  });

  it('rejects unknown operation kinds', () => {
    expect(() => validateOpParams([{ kind: 'unknown_operation' }])).toThrow('Invalid operation parameters');
  });

  it('rejects invalid operation addresses', () => {
    expect(() => validateOpParams([{ kind: 'transaction', to: 'mv1bad', amount: 1 }])).toThrow(
      'Invalid operation parameters'
    );
  });

  it('rejects invalid operation numeric fields', () => {
    expect(() => validateOpParams([{ kind: 'transaction', to: ACCOUNT_ADDRESS, amount: 1, fee: -1 }])).toThrow(
      'Invalid operation parameters'
    );
    expect(() =>
      validateOpParams([{ kind: 'transaction', to: ACCOUNT_ADDRESS, amount: 1, gasLimit: Infinity }])
    ).toThrow('Invalid operation parameters');
    expect(() => validateOpParams([{ kind: 'transaction', to: ACCOUNT_ADDRESS, amount: '1.5' }])).toThrow(
      'Invalid operation parameters'
    );
  });

  it('rejects malformed operation bodies', () => {
    expect(() => validateOpParams([{ kind: 'transaction', amount: 1 }])).toThrow('Invalid operation parameters');
    expect(() => validateOpParams([{ kind: 'origination', balance: 0 }])).toThrow('Invalid operation parameters');
  });
});

describe('buildFinalOpParmas', () => {
  it('applies fee overrides without mutating input params', () => {
    const opParams = [
      { kind: 'transaction', to: ACCOUNT_ADDRESS, amount: 1, fee: 10 },
      { kind: 'delegation', delegate: ACCOUNT_ADDRESS, fee: 5 }
    ];

    const result = buildFinalOpParmas(opParams, 99);

    expect(result).toEqual([
      { kind: 'transaction', to: ACCOUNT_ADDRESS, amount: 1, fee: 99 },
      { kind: 'delegation', delegate: ACCOUNT_ADDRESS, fee: 0 }
    ]);
    expect(opParams).toEqual([
      { kind: 'transaction', to: ACCOUNT_ADDRESS, amount: 1, fee: 10 },
      { kind: 'delegation', delegate: ACCOUNT_ADDRESS, fee: 5 }
    ]);
    expect(result[0]).not.toBe(opParams[0]);
    expect(result[1]).not.toBe(opParams[1]);
  });

  it('applies single-operation storage overrides without mutating input params', () => {
    const opParams = [{ kind: 'transaction', to: ACCOUNT_ADDRESS, amount: 1, storageLimit: 10 }];

    const result = buildFinalOpParmas(opParams, undefined, 42);

    expect(result).toEqual([{ kind: 'transaction', to: ACCOUNT_ADDRESS, amount: 1, storageLimit: 42 }]);
    expect(opParams).toEqual([{ kind: 'transaction', to: ACCOUNT_ADDRESS, amount: 1, storageLimit: 10 }]);
    expect(result[0]).not.toBe(opParams[0]);
  });

  it('rejects invalid fee and storage overrides', () => {
    expect(() => buildFinalOpParmas([{ kind: 'delegation' }], -1)).toThrow('Invalid fee override');
    expect(() => buildFinalOpParmas([{ kind: 'delegation' }], undefined, -1)).toThrow('Invalid storage limit override');
  });
});
