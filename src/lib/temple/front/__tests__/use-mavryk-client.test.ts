/**
 * Tests for useMavrykClient
 *
 * Mocking strategy:
 * - React's `useCallback` is mocked as an identity function — all hook callbacks are
 *   `useCallback(fn, [])` so this is equivalent and avoids needing a render environment.
 * - `lib/temple/front/client` is mocked to control `request`, `assertResponse`, and `intercom`.
 * - `lib/store/zustand/wallet.store` is mocked to spy on `walletStore.getState()` actions.
 * - `browser` global is provided by @temple-wallet/jest-webextension-mock (via setupFiles).
 */

// Mock useCallback as identity — all callbacks are useCallback(fn, []) so this is safe
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: (fn: any) => fn
}));

// nanoid v3 ships ESM-only in prod build; provide a stable stub for tests
jest.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

// ---------------------------------------------------------------------------
// Mock: lib/temple/front/client
// ---------------------------------------------------------------------------

const mockRequest = jest.fn();
const mockAssertResponse = jest.fn();

jest.mock('lib/temple/front/client', () => ({
  intercom: {},
  request: (...args: any[]) => mockRequest(...args),
  assertResponse: (condition: any) => mockAssertResponse(condition)
}));

// ---------------------------------------------------------------------------
// Mock: lib/temple/reset
// ---------------------------------------------------------------------------

jest.mock('lib/temple/reset', () => ({
  clearLocalStorage: jest.fn()
}));

// ---------------------------------------------------------------------------
// Mock: lib/store/zustand/wallet.store
// ---------------------------------------------------------------------------

const mockSetConfirmationId = jest.fn();
const mockResetConfirmation = jest.fn();
const mockSetWalletsSpecs = jest.fn();

jest.mock('lib/store/zustand/wallet.store', () => ({
  walletStore: {
    getState: () => ({
      setConfirmationId: mockSetConfirmationId,
      resetConfirmation: mockResetConfirmation,
      setWalletsSpecs: mockSetWalletsSpecs,
      confirmationId: null
    })
  }
}));

// ---------------------------------------------------------------------------
// Mock: lib/constants
// ---------------------------------------------------------------------------

jest.mock('lib/constants', () => ({
  WALLETS_SPECS_STORAGE_KEY: 'wallets_specs'
}));

// ---------------------------------------------------------------------------
// Import subject under test (after mocks are set up)
// ---------------------------------------------------------------------------

import browser from 'webextension-polyfill';

import { TempleMessageType } from 'lib/temple/types';

import { useMavrykClient } from '../use-mavryk-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupRequestSuccess(responseType: TempleMessageType, extra: Record<string, any> = {}) {
  mockRequest.mockResolvedValueOnce({ type: responseType, ...extra });
  mockAssertResponse.mockImplementation(() => {});
}

function setupRequestFailure(error: Error) {
  mockRequest.mockRejectedValueOnce(error);
  mockAssertResponse.mockImplementation(() => {});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMavrykClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Completeness: all 33 callbacks are present in the return value
  // -------------------------------------------------------------------------

  describe('return shape', () => {
    it('exports all expected action callbacks', () => {
      const actions = useMavrykClient();

      const expected = [
        'registerWallet',
        'unlock',
        'lock',
        'createAccount',
        'removeAccount',
        'editAccountName',
        'findFreeHdIndex',
        'updateAccountKYCStatus',
        'revealPrivateKey',
        'revealMnemonic',
        'generateSyncPayload',
        'importAccount',
        'importMnemonicAccount',
        'importFundraiserAccount',
        'importKTManagedAccount',
        'importWatchOnlyAccount',
        'createLedgerAccount',
        'createOrImportWallet',
        'updateSettings',
        'removeHdGroup',
        'removeAccountsByType',
        'editHdGroupName',
        'resetConfirmation',
        'confirmInternal',
        'getDAppPayload',
        'confirmDAppPermission',
        'confirmDAppOperation',
        'confirmDAppSign',
        'getAllDAppSessions',
        'removeAllDAppSessions',
        'removeDAppSession',
        'createWebMavrykWallet',
        'createWebMavrykSigner'
      ];

      for (const name of expected) {
        expect(typeof (actions as any)[name]).toBe('function');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Wallet lifecycle
  // -------------------------------------------------------------------------

  describe('registerWallet', () => {
    it('calls request with NewWalletRequest and returns accountPkh', async () => {
      setupRequestSuccess(TempleMessageType.NewWalletResponse, { accountPkh: 'mv1abc' });
      const { registerWallet } = useMavrykClient();

      const pkh = await registerWallet('password123', 'word1 word2');

      expect(mockRequest).toHaveBeenCalledWith({
        type: TempleMessageType.NewWalletRequest,
        password: 'password123',
        mnemonic: 'word1 word2'
      });
      expect(pkh).toBe('mv1abc');
    });
  });

  describe('unlock', () => {
    it('calls request with UnlockRequest', async () => {
      setupRequestSuccess(TempleMessageType.UnlockResponse);
      const { unlock } = useMavrykClient();

      await unlock('mypassword');

      expect(mockRequest).toHaveBeenCalledWith({
        type: TempleMessageType.UnlockRequest,
        password: 'mypassword'
      });
    });
  });

  describe('lock', () => {
    it('calls request with LockRequest', async () => {
      setupRequestSuccess(TempleMessageType.LockResponse);
      const { lock } = useMavrykClient();

      await lock();

      expect(mockRequest).toHaveBeenCalledWith({ type: TempleMessageType.LockRequest });
    });
  });

  // -------------------------------------------------------------------------
  // Account management
  // -------------------------------------------------------------------------

  describe('confirmInternal', () => {
    it('calls request with ConfirmationRequest and correct params', async () => {
      setupRequestSuccess(TempleMessageType.ConfirmationResponse);
      const { confirmInternal } = useMavrykClient();

      await confirmInternal('op-id-1', true, 1000, 300);

      expect(mockRequest).toHaveBeenCalledWith({
        type: TempleMessageType.ConfirmationRequest,
        id: 'op-id-1',
        confirmed: true,
        modifiedTotalFee: 1000,
        modifiedStorageLimit: 300
      });
    });
  });

  describe('resetConfirmation', () => {
    it('calls walletStore.getState().resetConfirmation()', () => {
      const { resetConfirmation } = useMavrykClient();
      resetConfirmation();
      expect(mockResetConfirmation).toHaveBeenCalledTimes(1);
    });
  });

  describe('revealPrivateKey', () => {
    it('calls request with RevealPrivateKeyRequest and returns key', async () => {
      setupRequestSuccess(TempleMessageType.RevealPrivateKeyResponse, { privateKey: 'pk_secret' });
      const { revealPrivateKey } = useMavrykClient();

      const key = await revealPrivateKey('mv1pkh', 'pw');

      expect(mockRequest).toHaveBeenCalledWith({
        type: TempleMessageType.RevealPrivateKeyRequest,
        accountPublicKeyHash: 'mv1pkh',
        password: 'pw'
      });
      expect(key).toBe('pk_secret');
    });

    it('logs timestamp only (no pkh, no password) and re-throws on failure', async () => {
      setupRequestFailure(new Error('Wrong password'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { revealPrivateKey } = useMavrykClient();

      await expect(revealPrivateKey('mv1pkh', 'badpw')).rejects.toThrow('Wrong password');

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [label, meta] = warnSpy.mock.calls[0];
      expect(label).toBe('[security] reveal_attempt_failed');
      expect(meta).toHaveProperty('timestamp');
      expect(meta).not.toHaveProperty('pkh');
      expect(meta).not.toHaveProperty('password');

      warnSpy.mockRestore();
    });
  });

  describe('revealMnemonic', () => {
    it('calls request with RevealMnemonicRequest and returns mnemonic on success', async () => {
      setupRequestSuccess(TempleMessageType.RevealMnemonicResponse, { mnemonic: 'word1 word2 word3' });
      const { revealMnemonic } = useMavrykClient();

      const mnemonic = await revealMnemonic('wallet-id', 'pw');

      expect(mockRequest).toHaveBeenCalledWith({
        type: TempleMessageType.RevealMnemonicRequest,
        walletId: 'wallet-id',
        password: 'pw'
      });
      expect(mnemonic).toBe('word1 word2 word3');
    });

    it('logs timestamp only (no password) and re-throws on failure', async () => {
      setupRequestFailure(new Error('Wrong password'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { revealMnemonic } = useMavrykClient();

      await expect(revealMnemonic('wallet-id', 'badpw')).rejects.toThrow('Wrong password');

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [label, meta] = warnSpy.mock.calls[0];
      expect(label).toBe('[security] reveal_attempt_failed');
      expect(meta).not.toHaveProperty('password');

      warnSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // dApp
  // -------------------------------------------------------------------------

  describe('confirmDAppPermission', () => {
    it('fetches public key and dispatches DAppPermConfirmationRequest', async () => {
      mockRequest.mockResolvedValueOnce({ type: TempleMessageType.RevealPublicKeyResponse, publicKey: 'edpk123' });
      mockRequest.mockResolvedValueOnce({ type: TempleMessageType.DAppPermConfirmationResponse });
      mockAssertResponse.mockImplementation(() => {});
      const { confirmDAppPermission } = useMavrykClient();

      await confirmDAppPermission('dapp-id', true, 'mv1pkh');

      expect(mockRequest).toHaveBeenNthCalledWith(1, {
        type: TempleMessageType.RevealPublicKeyRequest,
        accountPublicKeyHash: 'mv1pkh'
      });
      expect(mockRequest).toHaveBeenNthCalledWith(2, {
        type: TempleMessageType.DAppPermConfirmationRequest,
        id: 'dapp-id',
        confirmed: true,
        accountPublicKeyHash: 'mv1pkh',
        accountPublicKey: 'edpk123'
      });
    });

    it('calls resetConfirmation when getPublicKey throws', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Wallet locked'));
      mockAssertResponse.mockImplementation(() => {});
      const { confirmDAppPermission } = useMavrykClient();

      await expect(confirmDAppPermission('dapp-id', true, 'mv1pkh')).rejects.toThrow('Wallet locked');

      expect(mockResetConfirmation).toHaveBeenCalledTimes(1);
    });

    it('does NOT fetch public key when confirmed=false', async () => {
      mockRequest.mockResolvedValueOnce({ type: TempleMessageType.DAppPermConfirmationResponse });
      mockAssertResponse.mockImplementation(() => {});
      const { confirmDAppPermission } = useMavrykClient();

      await confirmDAppPermission('dapp-id', false, 'mv1pkh');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: TempleMessageType.DAppPermConfirmationRequest, accountPublicKey: '' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Signers: confirmation ID written to store (not a ref)
  // -------------------------------------------------------------------------

  describe('createWebMavrykWallet', () => {
    it('writes confirmation ID to walletStore.setConfirmationId on sendOperations', async () => {
      setupRequestSuccess(TempleMessageType.OperationsResponse, { opHash: 'oo123' });
      const { createWebMavrykWallet } = useMavrykClient();

      const wallet = createWebMavrykWallet('mv1pkh', 'https://rpc.example.com');
      await wallet.sendOperations([{ kind: 'transaction', destination: 'mv2', amount: '1000000', fee: '500' }]);

      expect(mockSetConfirmationId).toHaveBeenCalledTimes(1);
      expect(typeof mockSetConfirmationId.mock.calls[0][0]).toBe('string');
      expect(mockSetConfirmationId.mock.calls[0][0].length).toBeGreaterThan(0);
    });
  });

  describe('createWebMavrykSigner', () => {
    it('writes confirmation ID to walletStore.setConfirmationId on sign', async () => {
      mockRequest.mockResolvedValueOnce({ type: TempleMessageType.SignResponse, result: { signature: 'sig' } });
      mockAssertResponse.mockImplementation(() => {});
      const { createWebMavrykSigner } = useMavrykClient();

      const signer = createWebMavrykSigner('mv1pkh');
      await signer.sign('deadbeef');

      expect(mockSetConfirmationId).toHaveBeenCalledTimes(1);
      expect(typeof mockSetConfirmationId.mock.calls[0][0]).toBe('string');
      expect(mockSetConfirmationId.mock.calls[0][0].length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // editHdGroupName
  // -------------------------------------------------------------------------

  describe('editHdGroupName', () => {
    beforeEach(async () => {
      await browser.storage.local.remove('wallets_specs');
    });

    it('reads from browser.storage.local, merges name, writes back, and updates walletStore', async () => {
      await browser.storage.local.set({ wallets_specs: { 'wallet-1': { name: 'Old Name' } } });
      const { editHdGroupName } = useMavrykClient();

      await editHdGroupName('wallet-1', '  New Name  ');

      const stored = await browser.storage.local.get('wallets_specs');
      expect(stored['wallets_specs']['wallet-1'].name).toBe('New Name');
      expect(mockSetWalletsSpecs).toHaveBeenCalledWith(
        expect.objectContaining({ 'wallet-1': expect.objectContaining({ name: 'New Name' }) })
      );
    });

    it('truncates name to 64 characters', async () => {
      await browser.storage.local.set({ wallets_specs: { 'wallet-1': { name: 'Old Name' } } });
      const { editHdGroupName } = useMavrykClient();

      await editHdGroupName('wallet-1', 'A'.repeat(100));

      const stored = await browser.storage.local.get('wallets_specs');
      expect(stored['wallets_specs']['wallet-1'].name).toBe('A'.repeat(64));
    });

    it('throws when name is empty after trim', async () => {
      await browser.storage.local.set({ wallets_specs: { 'wallet-1': { name: 'Old Name' } } });
      const { editHdGroupName } = useMavrykClient();

      await expect(editHdGroupName('wallet-1', '   ')).rejects.toThrow('cannot be empty');
    });

    it('throws when wallet group id does not exist', async () => {
      await browser.storage.local.set({ wallets_specs: { 'wallet-1': { name: 'Existing' } } });
      const { editHdGroupName } = useMavrykClient();

      await expect(editHdGroupName('unknown-id', 'New Name')).rejects.toThrow('not found');
    });
  });
});
