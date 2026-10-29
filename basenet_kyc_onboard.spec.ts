import { MavrykToolkit, OpKind } from '@mavrykdynamics/webmavryk';
import { InMemorySigner } from '@mavrykdynamics/webmavryk-signer';

import { signKYCAction } from 'app/pages/ProVersion/utils/tezosSigner';
import { loadContract } from 'lib/temple/contract';
import { TempleChainId } from 'lib/temple/types';

const mockConfirmation = jest.fn();
const mockSend = jest.fn();
const mockBatch = jest.fn();
const mockSetProvider = jest.fn();

jest.mock('@mavrykdynamics/webmavryk', () => ({
  OpKind: { TRANSACTION: 'transaction' },
  MavrykToolkit: jest.fn(() => ({ setProvider: mockSetProvider, wallet: { batch: mockBatch } }))
}));
jest.mock('@mavrykdynamics/webmavryk-signer', () => ({ InMemorySigner: jest.fn() }));
jest.mock('lib/temple/contract', () => ({ loadContract: jest.fn() }));
jest.mock('lib/route3/constants', () => ({
  KYC_CONTRACTS: new Map([['NetXmtMsNf69w1w', 'test-kyc-contract']])
}));

const originalEnvironment = process.env;
const memberParams = { to: 'test-kyc-contract', amount: 0, parameter: { entrypoint: 'setMember' } };
const kycParams = { to: 'test-kyc-contract', amount: 0, parameter: { entrypoint: 'setMemberKyc' } };
const mockSetMember = jest.fn(() => ({ toTransferParams: () => memberParams }));
const mockSetMemberKyc = jest.fn(() => ({ toTransferParams: () => kycParams }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnvironment, NODE_ENV: 'test', TESTNET_KYC_SIGNER_PRIVATE_KEY: 'test-only-key' };
  mockConfirmation.mockResolvedValue(undefined);
  mockSend.mockResolvedValue({ opHash: 'test-operation', confirmation: mockConfirmation });
  mockBatch.mockReturnValue({ send: mockSend });
  (loadContract as unknown as jest.Mock).mockResolvedValue({
    methods: { setMember: mockSetMember, setMemberKyc: mockSetMemberKyc }
  });
});

afterEach(() => {
  process.env = originalEnvironment;
});

describe.each(['development', 'production'] as const)('Basenet KYC onboarding contract (%s)', nodeEnv => {
  beforeEach(() => {
    process.env = { ...process.env, NODE_ENV: nodeEnv };
  });

  it('batches Starter membership and NIL KYC for the buyer, then awaits one confirmation', async () => {
    const operation = await signKYCAction('test-rpc', 'test-buyer', TempleChainId.Basenet);

    expect(MavrykToolkit).toHaveBeenCalledWith('test-rpc');
    expect(InMemorySigner).toHaveBeenCalledWith('test-only-key');
    expect(mockSetProvider).toHaveBeenCalledWith({ signer: expect.any(InMemorySigner) });
    expect(loadContract).toHaveBeenCalledWith(expect.any(Object), 'test-kyc-contract');
    expect(mockSetMember).toHaveBeenCalledWith([
      { updateType: 'update', memberAddress: 'test-buyer', membershipTier: 'Starter' }
    ]);
    expect(mockSetMemberKyc).toHaveBeenCalledWith('addMemberKyc', [
      { memberAddress: 'test-buyer', country: 'NIL', region: 'NIL', investorType: 'NIL' }
    ]);
    expect(mockBatch).toHaveBeenCalledWith([
      { ...memberParams, kind: OpKind.TRANSACTION },
      { ...kycParams, kind: OpKind.TRANSACTION }
    ]);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockConfirmation).toHaveBeenCalledWith(1);
    expect(operation.opHash).toBe('test-operation');
  });

  it('does not report success before confirmation settles', async () => {
    let confirm!: () => void;
    let markConfirmationStarted!: () => void;
    const confirmationStarted = new Promise<void>(resolve => (markConfirmationStarted = resolve));
    mockConfirmation.mockImplementationOnce(() => {
      markConfirmationStarted();
      return new Promise<void>(resolve => (confirm = resolve));
    });
    let hasCompleted = false;
    const pending = signKYCAction('test-rpc', 'test-buyer', TempleChainId.Basenet).then(() => {
      hasCompleted = true;
    });
    await confirmationStarted;
    expect(mockConfirmation).toHaveBeenCalledWith(1);
    expect(hasCompleted).toBe(false);
    confirm();
    await pending;
    expect(hasCompleted).toBe(true);
  });

  it('propagates send and confirmation failures without automatic resubmission', async () => {
    mockSend.mockRejectedValueOnce(new Error('send failed'));
    await expect(signKYCAction('test-rpc', 'test-buyer', TempleChainId.Basenet)).rejects.toThrow('send failed');
    expect(mockConfirmation).not.toHaveBeenCalled();
    mockConfirmation.mockRejectedValueOnce(new Error('confirmation failed'));
    await expect(signKYCAction('test-rpc', 'test-buyer', TempleChainId.Basenet)).rejects.toThrow('confirmation failed');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
