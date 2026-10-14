import { MavrykToolkit } from '@mavrykdynamics/webmavryk';

import { loadContract } from 'lib/temple/contract';
import { TempleChainId } from 'lib/temple/types';

import { getKYCStatusFromContract, signerTezos } from './tezosSigner';

jest.mock('@mavrykdynamics/webmavryk', () => ({ MavrykToolkit: jest.fn() }));
jest.mock('@mavrykdynamics/webmavryk-signer', () => ({ InMemorySigner: jest.fn() }));
jest.mock('lib/temple/contract', () => ({ loadContract: jest.fn() }));
jest.mock('lib/route3/constants', () => ({
  KYC_CONTRACTS: new Map([['NetXmtMsNf69w1w', 'test-kyc-contract']])
}));

const originalEnvironment = process.env;

afterEach(() => {
  process.env = originalEnvironment;
  jest.clearAllMocks();
});

it('looks up membership by address in the registrar ledger and requires KYC too', async () => {
  const member = jest.fn().mockResolvedValue({ membershipTier: 'Starter' });
  const kyc = jest.fn().mockResolvedValue({ country: 'NIL' });
  const tupleLedger = jest.fn();
  (loadContract as unknown as jest.Mock).mockResolvedValue({
    storage: async () => ({
      memberRegistrarLedger: { get: member },
      memberKycLedger: { get: kyc },
      memberLedger: { get: tupleLedger }
    })
  });

  await expect(getKYCStatusFromContract('test-rpc', 'test-member', TempleChainId.Basenet)).resolves.toBe(true);
  expect(member).toHaveBeenCalledWith('test-member');
  expect(kyc).toHaveBeenCalledWith('test-member');
  expect(tupleLedger).not.toHaveBeenCalled();
  expect(loadContract).toHaveBeenCalledWith(expect.any(MavrykToolkit), 'test-kyc-contract', false);

  kyc.mockResolvedValue(undefined);
  await expect(getKYCStatusFromContract('test-rpc', 'test-member', TempleChainId.Basenet)).resolves.toBe(false);
  member.mockRejectedValue(new Error('RPC unavailable'));
  await expect(getKYCStatusFromContract('test-rpc', 'test-member', TempleChainId.Basenet)).rejects.toThrow(
    'RPC unavailable'
  );
});

it('retains production and non-Basenet signing guards after dev reconciliation', () => {
  process.env = { ...originalEnvironment, NODE_ENV: 'production', TESTNET_KYC_SIGNER_PRIVATE_KEY: 'test-only' };
  expect(() => signerTezos('test-rpc', TempleChainId.Basenet)).toThrow('Server-side signing is required');
  process.env = { ...originalEnvironment, NODE_ENV: 'test', TESTNET_KYC_SIGNER_PRIVATE_KEY: '' };
  expect(() => signerTezos('test-rpc', TempleChainId.Mainnet)).toThrow('only available on Basenet');
  expect(() => signerTezos('test-rpc', TempleChainId.Basenet)).toThrow('key is not configured');
});
