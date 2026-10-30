import browser from 'webextension-polyfill';

import * as Beacon from 'lib/temple/beacon';

import { consumeConfirmToken, getAllDApps, removeDAppSessionsForPkhs } from './dapp';

jest.mock('lib/temple/beacon', () => ({
  ...jest.requireActual('lib/temple/beacon'),
  removeDAppPublicKey: jest.fn()
}));

const mockedRemoveDAppPublicKey = Beacon.removeDAppPublicKey as jest.MockedFunction<typeof Beacon.removeDAppPublicKey>;

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

describe('removeDAppSessionsForPkhs', () => {
  const buildSession = (pkh: string) => ({ network: 'mainnet', appMeta: { name: 'dApp' }, pkh, publicKey: 'edpk' });
  const sessions = {
    'https://a.example': buildSession('mv1A'),
    'https://b.example': buildSession('mv1B'),
    'https://c.example': buildSession('mv1A')
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
    await browser.storage.local.set({ dapp_sessions: sessions });
  });

  it('drops every session bound to a removed pkh and its Beacon key', async () => {
    await removeDAppSessionsForPkhs(['mv1A']);

    expect(await getAllDApps()).toEqual({ 'https://b.example': sessions['https://b.example'] });
    expect(mockedRemoveDAppPublicKey.mock.calls).toEqual([['https://a.example'], ['https://c.example']]);
  });

  it('leaves the sessions untouched when no removed pkh has one', async () => {
    await removeDAppSessionsForPkhs(['mv1Z']);

    expect(await getAllDApps()).toEqual(sessions);
    expect(mockedRemoveDAppPublicKey).not.toHaveBeenCalled();
  });
});
