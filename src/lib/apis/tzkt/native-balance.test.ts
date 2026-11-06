import { TempleChainId } from 'lib/temple/types';

import { fetchTezosBalanceFromTzkt, getAccountStatsFromTzkt } from './api';

const mockGet = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ get: (...args: unknown[]) => mockGet(...args), interceptors: { response: { use: jest.fn() } } })
}));

beforeEach(() => mockGet.mockReset());

it('requests the native balance past the HTTP cache, so an identical in-flight lookup cannot hold it', async () => {
  mockGet.mockResolvedValueOnce({ data: { type: 'user', balance: 150, stakedBalance: 20, unstakedBalance: 30 } });

  await expect(fetchTezosBalanceFromTzkt('test-account', TempleChainId.Basenet)).resolves.toBe('100');
  expect(mockGet).toHaveBeenCalledWith('/accounts/test-account', {
    baseURL: 'https://basenet.api.mavryk.network/v1',
    params: undefined,
    headers: { 'Cache-Control': 'no-cache' }
  });
});

it('keeps account stats lookups on the default cache mode', async () => {
  mockGet.mockResolvedValueOnce({ data: { type: 'user', balance: 1 } });

  await getAccountStatsFromTzkt('test-account', TempleChainId.Basenet);
  expect(mockGet.mock.calls[0][1].headers).toBeUndefined();
});

it('still rejects an invalid native account', async () => {
  mockGet.mockResolvedValueOnce({ data: { type: 'unknown', balance: 1 } });

  await expect(fetchTezosBalanceFromTzkt('test-account', TempleChainId.Basenet)).rejects.toThrow(
    'Invalid native account'
  );
});
