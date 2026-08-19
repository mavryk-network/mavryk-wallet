import { consumeConfirmToken } from './dapp';

describe('consumeConfirmToken', () => {
  it('accepts a matching token once', () => {
    const result = consumeConfirmToken('token-1', 'token-1');

    expect(result).toEqual({
      isValid: true,
      nextToken: null
    });
  });

  it('rejects missing and mismatched tokens without consuming the expected token', () => {
    expect(consumeConfirmToken('token-1')).toEqual({
      isValid: false,
      nextToken: 'token-1'
    });
    expect(consumeConfirmToken('token-1', 'token-2')).toEqual({
      isValid: false,
      nextToken: 'token-1'
    });
  });

  it('rejects token reuse after consumption', () => {
    const consumed = consumeConfirmToken('token-1', 'token-1');

    expect(consumeConfirmToken(consumed.nextToken, 'token-1')).toEqual({
      isValid: false,
      nextToken: null
    });
  });
});
