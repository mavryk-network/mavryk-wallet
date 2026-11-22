import { isForegroundAnalyticsEvent, parseAnalyticsEventProperties } from './analytics-events.schema';
import {
  classifyOperations,
  toAnalyticsErrorCode,
  toAnalyticsNetwork,
  toAnalyticsNetworkFromRpc
} from './analytics.helpers';

describe('classifyOperations', () => {
  it('classifies wallet-side and dApp-side shapes by kind only', () => {
    expect(classifyOperations([{ kind: 'transaction', to: 'mv1', amount: 5 }])).toEqual({
      tx_type: 'send',
      asset_type: 'mvrk'
    });
    expect(
      classifyOperations([{ kind: 'transaction', to: 'KT1', amount: 0, parameter: { entrypoint: 'transfer' } }])
    ).toEqual({ tx_type: 'send', asset_type: 'token' });
    expect(
      classifyOperations([{ kind: 'transaction', destination: 'KT1', amount: '0', parameters: { entrypoint: 'swap' } }])
    ).toEqual({ tx_type: 'contract_call', asset_type: 'none' });
    expect(classifyOperations([{ kind: 'transaction', amount: 1, parameter: { entrypoint: 'stake' } }])).toEqual({
      tx_type: 'stake',
      asset_type: 'mvrk'
    });
    expect(classifyOperations([{ kind: 'reveal' }, { kind: 'delegation', delegate: 'mv1' }])).toEqual({
      tx_type: 'delegate',
      asset_type: 'none'
    });
    expect(classifyOperations([{ kind: 'origination' }])).toEqual({ tx_type: 'origination', asset_type: 'none' });
    expect(classifyOperations([{ kind: 'transaction' }, { kind: 'transaction' }])).toEqual({
      tx_type: 'batch',
      asset_type: 'none'
    });
    expect(classifyOperations(undefined)).toEqual({ tx_type: 'other', asset_type: 'none' });
  });
});

describe('toAnalyticsErrorCode', () => {
  it('keeps protocol error ids without the protocol prefix', () => {
    expect(
      toAnalyticsErrorCode({ errors: [{ id: 'proto.002-PtBoreas.michelson_v1.script_rejected' }, { id: 'x' }] })
    ).toBe('x');
    expect(toAnalyticsErrorCode({ errors: [{ id: 'proto.002-PtBoreas.contract.balance_too_low' }] })).toBe(
      'contract.balance_too_low'
    );
  });

  it('never returns raw messages', () => {
    expect(toAnalyticsErrorCode(new Error('NOT_GRANTED'))).toBe('NOT_GRANTED');
    expect(toAnalyticsErrorCode(new Error('Failed for mv1Abc… with 12.5 MVRK'))).toBe('unknown');
    expect(toAnalyticsErrorCode({ errors: [{ id: 'has spaces mv1Abc' }] })).toBe('unknown');
    expect(toAnalyticsErrorCode(null)).toBe('unknown');
  });
});

describe('network buckets', () => {
  it('never exposes custom network ids or RPC URLs', () => {
    expect(toAnalyticsNetwork(undefined)).toBe('mainnet');
    expect(toAnalyticsNetwork('basenet')).toBe('basenet');
    expect(toAnalyticsNetwork('atlasnet')).toBe('basenet');
    expect(toAnalyticsNetwork('my-custom-node')).toBe('custom');
    expect(toAnalyticsNetworkFromRpc('https://mainnet.rpc.mavryk.network/')).toBe('mainnet');
    expect(toAnalyticsNetworkFromRpc('https://basenet.rpc.mavryk.network')).toBe('basenet');
    expect(toAnalyticsNetworkFromRpc('https://private.example.com')).toBe('custom');
  });
});

describe('event whitelist', () => {
  it('rejects unknown events and any extra or invalid property', () => {
    expect(parseAnalyticsEventProperties('wallet_created', undefined)).toEqual({});
    expect(parseAnalyticsEventProperties('account_added', { type: 'ledger' })).toEqual({ type: 'ledger' });
    expect(parseAnalyticsEventProperties('account_added', { type: 'ledger', address: 'mv1' })).toBeNull();
    expect(parseAnalyticsEventProperties('wallet_created', { publicKey: 'edpk' })).toBeNull();
    expect(
      parseAnalyticsEventProperties('tx_failed', { tx_type: 'send', source: 'wallet', error_code: 'a b' })
    ).toBeNull();
    expect(parseAnalyticsEventProperties('analytics_opt_in_changed', { enabled: false })).toBeNull();
    expect(parseAnalyticsEventProperties('toString', {})).toBeNull();
  });

  it('lets extension pages request only foreground events', () => {
    expect(isForegroundAnalyticsEvent('contact_added')).toBe(true);
    expect(isForegroundAnalyticsEvent('tx_confirmed')).toBe(false);
  });
});
