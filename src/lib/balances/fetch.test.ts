import { MavrykToolkit } from '@mavrykdynamics/webmavryk';
import BigNumber from 'bignumber.js';

import { fixBalances } from 'app/store/balances/utils';
import { TzktAccount, TzktAccountType } from 'lib/apis/tzkt/types';
import { calcTzktAccountSpendableTezBalance } from 'lib/apis/tzkt/utils';
import { fromAssetSlugWithStandardDetect } from 'lib/assets/contract.utils';
import { loadContract } from 'lib/temple/contract';

import { fetchRawBalance } from './fetch';

jest.mock('lib/assets/contract.utils', () => ({ fromAssetSlugWithStandardDetect: jest.fn() }));
jest.mock('lib/temple/contract', () => ({ loadContract: jest.fn() }));

it('retains valid zero/precision and propagates native RPC failures', async () => {
  (fromAssetSlugWithStandardDetect as jest.Mock).mockResolvedValue('mav');
  const tezos = { mv: { getBalance: jest.fn().mockResolvedValue(new BigNumber('12345678901234567890')) } };
  expect((await fetchRawBalance(tezos as unknown as MavrykToolkit, 'mav', 'alice')).toFixed()).toBe(
    '12345678901234567890'
  );
  tezos.mv.getBalance.mockResolvedValue(new BigNumber(0));
  expect((await fetchRawBalance(tezos as unknown as MavrykToolkit, 'mav', 'alice')).toFixed()).toBe('0');
  tezos.mv.getBalance.mockRejectedValue(new Error('offline'));
  await expect(fetchRawBalance(tezos as unknown as MavrykToolkit, 'mav', 'alice')).rejects.toThrow('offline');
});

it('does not convert rejected or malformed FA2/FA1.2 views into zero', async () => {
  const read = jest.fn();
  (loadContract as unknown as jest.Mock).mockResolvedValue({
    views: { balance_of: () => ({ read }), getBalance: () => ({ read }) }
  });
  const tezos = {} as MavrykToolkit;
  for (const asset of [
    { contract: 'KT1test', id: 0, type: 'fa2' },
    { contract: 'KT1test', type: 'fa1.2' }
  ]) {
    (fromAssetSlugWithStandardDetect as jest.Mock).mockResolvedValue(asset);
    read.mockRejectedValueOnce(new Error('view failed'));
    await expect(fetchRawBalance(tezos, 'KT1test_0', 'alice')).rejects.toThrow('view failed');
    read.mockResolvedValueOnce(undefined);
    await expect(fetchRawBalance(tezos, 'KT1test_0', 'alice')).rejects.toThrow();
  }
});

it('calculates exact spendable native values and rejects missing/unsafe input', () => {
  const account = { type: TzktAccountType.User, balance: 100, stakedBalance: 30, unstakedBalance: 20 } as TzktAccount;
  expect(calcTzktAccountSpendableTezBalance(account)).toBe('50');
  expect(calcTzktAccountSpendableTezBalance({ type: TzktAccountType.Empty } as TzktAccount)).toBe('0');
  expect(() => calcTzktAccountSpendableTezBalance({ type: TzktAccountType.User } as TzktAccount)).toThrow();
  expect(() => calcTzktAccountSpendableTezBalance({ ...account, balance: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  expect(
    calcTzktAccountSpendableTezBalance({
      ...account,
      balance: '999999999999999999999',
      stakedBalance: '1',
      unstakedBalance: '2'
    } as unknown as TzktAccount)
  ).toBe('999999999999999999996');
});

it('preserves exact fractional Yupana normalization without modifying unrelated values', () => {
  const slug = 'KT1Rk86CX85DjBKmuyBhrCyNsHyudHVtASec_0';
  expect(fixBalances({ [slug]: '1', other: '100000000000000000000' })).toEqual({
    [slug]: '0.000000000000000001',
    other: '100000000000000000000'
  });
});
