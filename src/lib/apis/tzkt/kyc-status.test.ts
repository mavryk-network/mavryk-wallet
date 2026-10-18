import { TempleChainId } from 'lib/temple/types';

import { getKYCStatus } from './api';

const mockGet = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ get: (...args: unknown[]) => mockGet(...args), interceptors: { response: { use: jest.fn() } } })
}));
jest.mock('lib/route3/constants', () => ({
  KYC_CONTRACTS: new Map([['NetXmtMsNf69w1w', 'test-kyc-contract']])
}));

beforeEach(() => mockGet.mockReset());

it('uses the address-keyed registrar index and requires both membership and KYC, as on dev', async () => {
  mockGet
    .mockResolvedValueOnce({ data: { memberLedger: 1, memberRegistrarLedger: 2, memberKycLedger: 3 } })
    .mockResolvedValueOnce({ data: { value: ['test-registrar'] } })
    .mockResolvedValueOnce({ data: { value: { country: 'NIL' } } });

  await expect(getKYCStatus('test-member', TempleChainId.Basenet)).resolves.toBe(true);
  expect(mockGet.mock.calls.map(([endpoint]) => endpoint)).toEqual([
    '/contracts/test-kyc-contract/storage/',
    '/bigmaps/2/keys/test-member',
    '/bigmaps/3/keys/test-member'
  ]);
});

it.each([
  [null, {}],
  [{}, null]
])('returns false when either ledger entry is absent', async (member, kyc) => {
  mockGet
    .mockResolvedValueOnce({ data: { memberRegistrarLedger: 2, memberKycLedger: 3 } })
    .mockResolvedValueOnce({ data: member })
    .mockResolvedValueOnce({ data: kyc });

  await expect(getKYCStatus('test-member', TempleChainId.Basenet)).resolves.toBe(false);
});

it.each([null, 'unknown-chain', TempleChainId.Mainnet])(
  'returns false without requests for unsupported configuration',
  async chainId => {
    await expect(getKYCStatus('test-member', chainId)).resolves.toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  }
);

it('retains dev behavior for missing storage fields and failed requests', async () => {
  mockGet.mockResolvedValueOnce({ data: { memberLedger: 1, memberKycLedger: 3 } });
  await expect(getKYCStatus('test-member', TempleChainId.Basenet)).resolves.toBe(false);
  expect(mockGet).toHaveBeenCalledTimes(1);

  mockGet.mockRejectedValueOnce(new Error('Indexer unavailable'));
  await expect(getKYCStatus('test-member', TempleChainId.Basenet)).resolves.toBe(false);

  mockGet
    .mockResolvedValueOnce({ data: { memberRegistrarLedger: 2, memberKycLedger: 3 } })
    .mockResolvedValueOnce({ data: {} })
    .mockRejectedValueOnce(new Error('Key not found'));
  await expect(getKYCStatus('test-member', TempleChainId.Basenet)).resolves.toBe(false);
});
