import { useCallback } from 'react';

import {
  WalletProvider,
  createOriginationOperation,
  createSetDelegateOperation,
  createIncreasePaidStorageOperation,
  createTransferOperation,
  WalletDelegateParams,
  WalletOriginateParams,
  WalletIncreasePaidStorageParams,
  WalletTransferParams,
  Signer,
  WalletStakeParams,
  WalletUnstakeParams,
  WalletFinalizeUnstakeParams
} from '@mavrykdynamics/webmavryk';
import {
  DelegateParams,
  FinalizeUnstakeParams,
  TransferParams
} from '@mavrykdynamics/webmavryk/dist/types/operations/types';
import { buf2hex } from '@mavrykdynamics/webmavryk-utils';
import browser from 'webextension-polyfill';
import { omit } from 'lodash';
import { nanoid } from 'nanoid';
import toBuffer from 'typedarray-to-buffer';

import { WALLETS_SPECS_STORAGE_KEY } from 'lib/constants';
import { walletStore } from 'lib/store/zustand/wallet.store';
import { clearLocalStorage } from 'lib/temple/reset';
import {
  TempleMessageType,
  TempleSettings,
  TempleChainKind,
  TempleAccountType,
  SaveLedgerAccountInput,
  WalletSpecs
} from 'lib/temple/types';

import { intercom, request, assertResponse } from './client';

// ---------------------------------------------------------------------------
// Private helpers (module-scoped, stable references)
// ---------------------------------------------------------------------------

async function getPublicKey(accountPublicKeyHash: string): Promise<string> {
  const res = await request({
    type: TempleMessageType.RevealPublicKeyRequest,
    accountPublicKeyHash
  });
  assertResponse(res.type === TempleMessageType.RevealPublicKeyResponse);
  return res.publicKey;
}

type WebMavrykWalletOps = {
  onBeforeSend?: (id: string) => void;
};

class WebMavrykWallet implements WalletProvider {
  constructor(private pkh: string, private rpc: string, private opts: WebMavrykWalletOps = {}) {}

  async getPKH() {
    return this.pkh;
  }

  getPK() {
    return getPublicKey(this.pkh);
  }

  async mapIncreasePaidStorageWalletParams(params: () => Promise<WalletIncreasePaidStorageParams>) {
    const walletParams = await params();
    return withoutFeesOverride(walletParams, await createIncreasePaidStorageOperation(walletParams));
  }

  async mapTransferParamsToWalletParams(params: () => Promise<WalletTransferParams>) {
    const walletParams = await params();
    return withoutFeesOverride(walletParams, await createTransferOperation(walletParams));
  }

  async mapOriginateParamsToWalletParams(params: () => Promise<WalletOriginateParams>) {
    const walletParams = await params();
    return withoutFeesOverride(walletParams, await createOriginationOperation(walletParams));
  }

  async mapDelegateParamsToWalletParams(params: () => Promise<WalletDelegateParams>) {
    const walletParams = await params();
    return withoutFeesOverride(walletParams, await createSetDelegateOperation(walletParams as unknown as DelegateParams));
  }

  async mapStakeParamsToWalletParams(params: () => Promise<WalletStakeParams>) {
    const walletParams = await params();
    return withoutFeesOverride(walletParams, await createTransferOperation(walletParams as unknown as TransferParams));
  }

  async mapUnstakeParamsToWalletParams(params: () => Promise<WalletUnstakeParams>) {
    const walletParams = await params();
    return withoutFeesOverride(walletParams, await createTransferOperation(walletParams as unknown as TransferParams));
  }

  async mapFinalizeUnstakeParamsToWalletParams(params: () => Promise<WalletFinalizeUnstakeParams>) {
    const walletParams = await params();
    return withoutFeesOverride(walletParams, await createTransferOperation(walletParams as unknown as TransferParams));
  }

  async sendOperations(opParams: any[]) {
    const id = nanoid();
    if (this.opts.onBeforeSend) {
      this.opts.onBeforeSend(id);
    }
    const res = await request({
      type: TempleMessageType.OperationsRequest,
      id,
      sourcePkh: this.pkh,
      networkRpc: this.rpc,
      opParams: opParams.map(formatOpParams)
    });
    assertResponse(res.type === TempleMessageType.OperationsResponse);
    return res.opHash;
  }

  async sign(): Promise<string> {
    throw new Error('Cannot sign');
  }
}

class TempleSigner implements Signer {
  constructor(private pkh: string, private onBeforeSign?: (id: string) => void) {}

  async publicKeyHash() {
    return this.pkh;
  }

  async publicKey(): Promise<string> {
    return getPublicKey(this.pkh);
  }

  async secretKey(): Promise<string> {
    throw new Error('Secret key cannot be exposed');
  }

  async sign(bytes: string, watermark?: Uint8Array) {
    const id = nanoid();
    if (this.onBeforeSign) {
      this.onBeforeSign(id);
    }
    const res = await request({
      type: TempleMessageType.SignRequest,
      sourcePkh: this.pkh,
      id,
      bytes,
      watermark: watermark ? buf2hex(new Uint8Array(toBuffer(watermark))) : undefined
    });
    assertResponse(res.type === TempleMessageType.SignResponse);
    return res.result;
  }
}

function formatOpParams(op: any) {
  switch (op.kind) {
    case 'origination':
      return {
        ...op,
        mumav: true
      };
    case 'transaction': {
      const { destination, amount, parameters, ...txRest } = op;
      return {
        ...txRest,
        to: destination,
        amount: +amount,
        mumav: true,
        parameter: parameters
      };
    }
    default:
      return op;
  }
}

function withoutFeesOverride<T>(params: any, op: T): T {
  const { fee, gasLimit, storageLimit } = params;
  return {
    ...op,
    ...(fee !== undefined && { fee }),
    ...(gasLimit !== undefined && { gas_limit: gasLimit }),
    ...(storageLimit !== undefined && { storage_limit: storageLimit })
  };
}

// ---------------------------------------------------------------------------
// useMavrykClient
// ---------------------------------------------------------------------------

/**
 * Action-only hook for the Mavryk wallet backend.
 *
 * Rules:
 * - No state subscriptions — never calls useWalletStore(selector).
 * - Store state is read imperatively via walletStore.getState() when needed.
 * - All callbacks are stable (useCallback with [] deps).
 * - Safe for use outside a React re-render cycle.
 *
 * Known constraint: createWebMavrykWallet / createWebMavrykSigner both write
 * to walletStore confirmationId. If two signers are created concurrently, the
 * second overwrites the first's ID. This is acceptable given the single-op UI
 * flow. The confirmation UI should disable the trigger while a confirmation
 * is pending.
 */
export function useMavrykClient() {
  // ---- Wallet lifecycle ----

  const registerWallet = useCallback(async (password: string, mnemonic?: string) => {
    const res = await request({
      type: TempleMessageType.NewWalletRequest,
      password,
      mnemonic
    });
    assertResponse(res.type === TempleMessageType.NewWalletResponse);
    clearLocalStorage(['onboarding', 'analytics']);
    return res.accountPkh;
  }, []);

  const unlock = useCallback(async (password: string) => {
    const res = await request({
      type: TempleMessageType.UnlockRequest,
      password
    });
    assertResponse(res.type === TempleMessageType.UnlockResponse);
  }, []);

  const lock = useCallback(async () => {
    const res = await request({
      type: TempleMessageType.LockRequest
    });
    assertResponse(res.type === TempleMessageType.LockResponse);
  }, []);

  // ---- Account management ----

  const createAccount = useCallback(async (walletId: string, name?: string) => {
    const res = await request({
      type: TempleMessageType.CreateAccountRequest,
      name,
      walletId
    });
    assertResponse(res.type === TempleMessageType.CreateAccountResponse);
  }, []);

  const removeAccount = useCallback(async (accountPublicKeyHash: string, password: string) => {
    const res = await request({
      type: TempleMessageType.RemoveAccountRequest,
      accountPublicKeyHash,
      password
    });
    assertResponse(res.type === TempleMessageType.RemoveAccountResponse);
  }, []);

  const editAccountName = useCallback(async (accountPublicKeyHash: string, name: string) => {
    const res = await request({
      type: TempleMessageType.EditAccountRequest,
      accountPublicKeyHash,
      name
    });
    assertResponse(res.type === TempleMessageType.EditAccountResponse);
  }, []);

  const findFreeHdIndex = useCallback(async (walletId: string) => {
    const res = await request({
      type: TempleMessageType.FindFreeHDAccountIndexRequest,
      walletId
    });
    assertResponse(res.type === TempleMessageType.FindFreeHDAccountIndexResponse);
    return omit(res, 'type');
  }, []);

  const updateAccountKYCStatus = useCallback(async (accountPublicKeyHash: string, isKYC: boolean) => {
    const res = await request({
      type: TempleMessageType.UpdateKYCAccountRequest,
      accountPublicKeyHash,
      isKYC
    });
    assertResponse(res.type === TempleMessageType.UpdateKYCAccountResponse);
  }, []);

  const revealPrivateKey = useCallback(async (accountPublicKeyHash: string, password: string) => {
    try {
      const res = await request({
        type: TempleMessageType.RevealPrivateKeyRequest,
        accountPublicKeyHash,
        password
      });
      assertResponse(res.type === TempleMessageType.RevealPrivateKeyResponse);
      return res.privateKey;
    } catch (err) {
      console.warn('[security] reveal_attempt_failed', { timestamp: Date.now() });
      throw err;
    }
  }, []);

  const revealMnemonic = useCallback(async (walletId: string, password: string) => {
    try {
      const res = await request({
        type: TempleMessageType.RevealMnemonicRequest,
        walletId,
        password
      });
      assertResponse(res.type === TempleMessageType.RevealMnemonicResponse);
      return res.mnemonic;
    } catch (err) {
      console.warn('[security] reveal_attempt_failed', { timestamp: Date.now() });
      throw err;
    }
  }, []);

  const generateSyncPayload = useCallback(async (password: string) => {
    const res = await request({
      type: TempleMessageType.GenerateSyncPayloadRequest,
      password
    });
    assertResponse(res.type === TempleMessageType.GenerateSyncPayloadResponse);
    return res.payload;
  }, []);

  // ---- Import ----

  const importAccount = useCallback(async (privateKey: string, chainId: string, encPassword?: string) => {
    const res = await request({
      type: TempleMessageType.ImportAccountRequest,
      privateKey,
      chainId,
      encPassword,
      chain: TempleChainKind.Tezos
    });
    assertResponse(res.type === TempleMessageType.ImportAccountResponse);
  }, []);

  const importMnemonicAccount = useCallback(
    async (mnemonic: string, chainId: string, password?: string, derivationPath?: string) => {
      const res = await request({
        type: TempleMessageType.ImportMnemonicAccountRequest,
        mnemonic,
        password,
        chainId,
        derivationPath
      });
      assertResponse(res.type === TempleMessageType.ImportMnemonicAccountResponse);
    },
    []
  );

  const importFundraiserAccount = useCallback(
    async (email: string, password: string, mnemonic: string, chainId: string) => {
      const res = await request({
        type: TempleMessageType.ImportFundraiserAccountRequest,
        email,
        password,
        mnemonic,
        chainId
      });
      assertResponse(res.type === TempleMessageType.ImportFundraiserAccountResponse);
    },
    []
  );

  const importKTManagedAccount = useCallback(async (address: string, chainId: string, owner: string) => {
    const res = await request({
      type: TempleMessageType.ImportManagedKTAccountRequest,
      address,
      chainId,
      owner
    });
    assertResponse(res.type === TempleMessageType.ImportManagedKTAccountResponse);
  }, []);

  const importWatchOnlyAccount = useCallback(async (address: string, chainId?: string, name?: string) => {
    const res = await request({
      type: TempleMessageType.ImportWatchOnlyAccountRequest,
      address,
      chainId,
      name,
      chain: TempleChainKind.Tezos
    });
    assertResponse(res.type === TempleMessageType.ImportWatchOnlyAccountResponse);
  }, []);

  const createLedgerAccount = useCallback(async (input: SaveLedgerAccountInput) => {
    const res = await request({
      type: TempleMessageType.CreateLedgerAccountRequest,
      input
    });
    assertResponse(res.type === TempleMessageType.CreateLedgerAccountResponse);
  }, []);

  const createOrImportWallet = useCallback(async (mnemonic?: string) => {
    const res = await request({
      type: TempleMessageType.CreateOrImportWalletRequest,
      mnemonic
    });
    assertResponse(res.type === TempleMessageType.CreateOrImportWalletResponse);
  }, []);

  // ---- Settings & groups ----

  const updateSettings = useCallback(async (newSettings: Partial<TempleSettings>) => {
    const res = await request({
      type: TempleMessageType.UpdateSettingsRequest,
      settings: newSettings
    });
    assertResponse(res.type === TempleMessageType.UpdateSettingsResponse);
  }, []);

  const removeHdGroup = useCallback(async (id: string, password: string) => {
    const res = await request({
      type: TempleMessageType.RemoveHdWalletRequest,
      id,
      password
    });
    assertResponse(res.type === TempleMessageType.RemoveHdWalletResponse);
  }, []);

  const removeAccountsByType = useCallback(
    async (type: Exclude<TempleAccountType, TempleAccountType.HD>, password: string) => {
      const res = await request({
        type: TempleMessageType.RemoveAccountsByTypeRequest,
        accountsType: type,
        password
      });
      assertResponse(res.type === TempleMessageType.RemoveAccountsByTypeResponse);
    },
    []
  );

  /**
   * editHdGroupName — writes the group name directly to browser.storage.local.
   *
   * NOTE: The plan specifies this should route via Intercom to Vault.editGroupName,
   * but no EditHdGroupRequest TempleMessageType exists in the current codebase.
   * This implementation matches the current client.ts behaviour (direct storage write)
   * to avoid introducing a half-implemented Intercom path. A future task should add
   * EditHdGroupRequest/Response to TempleMessageType, a Vault handler, and an actions.ts
   * dispatcher — then update this to use request({ type: TempleMessageType.EditHdGroupRequest }).
   */
  const editHdGroupName = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim().slice(0, 64);
    if (!trimmed) throw new Error('Wallet group name cannot be empty');

    const raw = await browser.storage.local.get(WALLETS_SPECS_STORAGE_KEY);
    const prevSpecs: StringRecord<WalletSpecs> = raw[WALLETS_SPECS_STORAGE_KEY] ?? {};

    if (!prevSpecs[id]) throw new Error(`Wallet group "${id}" not found`);

    const newSpecs: StringRecord<WalletSpecs> = {
      ...prevSpecs,
      [id]: {
        ...prevSpecs[id],
        name: trimmed
      }
    };
    await browser.storage.local.set({ [WALLETS_SPECS_STORAGE_KEY]: newSpecs });
    walletStore.getState().setWalletsSpecs(newSpecs);
  }, []);

  // ---- Confirmation ----

  const resetConfirmation = useCallback(() => {
    walletStore.getState().resetConfirmation();
  }, []);

  const confirmInternal = useCallback(
    async (id: string, confirmed: boolean, modifiedTotalFee?: number, modifiedStorageLimit?: number) => {
      const res = await request({
        type: TempleMessageType.ConfirmationRequest,
        id,
        confirmed,
        modifiedTotalFee,
        modifiedStorageLimit
      });
      assertResponse(res.type === TempleMessageType.ConfirmationResponse);
    },
    []
  );

  // ---- dApp ----

  const getDAppPayload = useCallback(async (id: string, token: string) => {
    const res = await request({
      type: TempleMessageType.DAppGetPayloadRequest,
      id,
      token
    });
    assertResponse(res.type === TempleMessageType.DAppGetPayloadResponse);
    return res.payload;
  }, []);

  /**
   * confirmDAppPermission — fetches the public key inline before dispatching.
   *
   * If getPublicKey throws (e.g. wallet locked between user click and key lookup),
   * resetConfirmation() is called to clean up backend pending state before re-throwing.
   */
  const confirmDAppPermission = useCallback(async (id: string, confirmed: boolean, pkh: string) => {
    try {
      const accountPublicKey = confirmed ? await getPublicKey(pkh) : '';
      const res = await request({
        type: TempleMessageType.DAppPermConfirmationRequest,
        id,
        confirmed,
        accountPublicKeyHash: pkh,
        accountPublicKey
      });
      assertResponse(res.type === TempleMessageType.DAppPermConfirmationResponse);
    } catch (err) {
      walletStore.getState().resetConfirmation();
      throw err;
    }
  }, []);

  const confirmDAppOperation = useCallback(
    async (id: string, confirmed: boolean, modifiedTotalFee?: number, modifiedStorageLimit?: number) => {
      const res = await request({
        type: TempleMessageType.DAppOpsConfirmationRequest,
        id,
        confirmed,
        modifiedTotalFee,
        modifiedStorageLimit
      });
      assertResponse(res.type === TempleMessageType.DAppOpsConfirmationResponse);
    },
    []
  );

  const confirmDAppSign = useCallback(async (id: string, confirmed: boolean) => {
    const res = await request({
      type: TempleMessageType.DAppSignConfirmationRequest,
      id,
      confirmed
    });
    assertResponse(res.type === TempleMessageType.DAppSignConfirmationResponse);
  }, []);

  const getAllDAppSessions = useCallback(async () => {
    const res = await request({
      type: TempleMessageType.DAppGetAllSessionsRequest
    });
    assertResponse(res.type === TempleMessageType.DAppGetAllSessionsResponse);
    return res.sessions;
  }, []);

  const removeAllDAppSessions = useCallback(async (origins: string[]) => {
    const res = await request({
      type: TempleMessageType.DAppRemoveAllSessionsRequest,
      origins
    });
    assertResponse(res.type === TempleMessageType.DAppRemoveAllSessionsResponse);
    return res.sessions;
  }, []);

  const removeDAppSession = useCallback(async (origin: string) => {
    const res = await request({
      type: TempleMessageType.DAppRemoveSessionRequest,
      origin
    });
    assertResponse(res.type === TempleMessageType.DAppRemoveSessionResponse);
    return res.sessions;
  }, []);

  // ---- Signers ----

  /**
   * createWebMavrykWallet — writes confirmation ID to walletStore imperatively.
   * No confirmationIdRef; walletStore.getState() is the canonical read path.
   */
  const createWebMavrykWallet = useCallback(
    (sourcePkh: string, networkRpc: string) =>
      new WebMavrykWallet(sourcePkh, networkRpc, {
        onBeforeSend: id => {
          walletStore.getState().setConfirmationId(id);
        }
      }),
    []
  );

  /**
   * createWebMavrykSigner — writes confirmation ID to walletStore imperatively.
   * No confirmationIdRef; walletStore.getState() is the canonical read path.
   */
  const createWebMavrykSigner = useCallback(
    (sourcePkh: string) =>
      new TempleSigner(sourcePkh, id => {
        walletStore.getState().setConfirmationId(id);
      }),
    []
  );

  return {
    // Wallet lifecycle
    registerWallet,
    unlock,
    lock,

    // Account management
    createAccount,
    removeAccount,
    editAccountName,
    findFreeHdIndex,
    updateAccountKYCStatus,
    revealPrivateKey,
    revealMnemonic,
    generateSyncPayload,

    // Import
    importAccount,
    importMnemonicAccount,
    importFundraiserAccount,
    importKTManagedAccount,
    importWatchOnlyAccount,
    createLedgerAccount,
    createOrImportWallet,

    // Settings & groups
    updateSettings,
    removeHdGroup,
    removeAccountsByType,
    editHdGroupName,

    // Confirmation
    resetConfirmation,
    confirmInternal,

    // dApp
    getDAppPayload,
    confirmDAppPermission,
    confirmDAppOperation,
    confirmDAppSign,
    getAllDAppSessions,
    removeAllDAppSessions,
    removeDAppSession,

    // Signers
    createWebMavrykWallet,
    createWebMavrykSigner
  };
}

// Re-export intercom for consumers that import from this module path
export { intercom };
