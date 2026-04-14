import { useCallback, useMemo, useRef } from 'react';

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
  StakeParams,
  TransferParams,
  UnstakeParams
} from '@mavrykdynamics/webmavryk/dist/types/operations/types';
import { buf2hex } from '@mavrykdynamics/webmavryk-utils';
import constate from 'constate';
import { omit } from 'lodash';
import { nanoid } from 'nanoid';
import toBuffer from 'typedarray-to-buffer';

import { WALLETS_SPECS_STORAGE_KEY } from 'lib/constants';
import { IntercomClient } from 'lib/intercom';
import { startIntercomSync } from 'lib/store/zustand/intercom-sync';
import { useWalletStore, useWalletSuspense, walletStore } from 'lib/store/zustand/wallet.store';
import { clearLocalStorage } from 'lib/temple/reset';
import {
  TempleMessageType,
  TempleRequest,
  TempleResponse,
  TempleSettings,
  TempleChainKind,
  WalletSpecs,
  SaveLedgerAccountInput,
  TempleAccountType
} from 'lib/temple/types';

import { useStorage } from './storage';

export const intercom = new IntercomClient();

// Start intercom sync at module level so it runs before any React Suspense boundary.
// This avoids a deadlock where useWalletSuspense() suspends rendering, preventing the
// useEffect that would trigger the initial state fetch from ever firing.
startIntercomSync(intercom);

const useTempleClientImpl = () => {
  /**
   * State — now reads from Zustand walletStore (synced via intercom-sync.ts).
   * The Suspense hook throws a promise until the initial state fetch completes.
   */
  useWalletSuspense();

  const status = useWalletStore(s => s.status);
  const accounts = useWalletStore(s => s.accounts);
  const defaultNetworks = useWalletStore(s => s.networks);
  const settings = useWalletStore(s => s.settings);
  const confirmation = useWalletStore(s => s.confirmation);

  const idle = useWalletStore(s => s.idle);
  const locked = useWalletStore(s => s.locked);
  const ready = useWalletStore(s => s.ready);

  const state = useMemo(
    () => ({ status, accounts, networks: defaultNetworks, settings }),
    [status, accounts, defaultNetworks, settings]
  );

  const confirmationIdRef = useRef<string | null>(null);
  const resetConfirmation = useCallback(() => {
    confirmationIdRef.current = null;
    walletStore.getState().resetConfirmation();
  }, []);

  const [walletsSpecs, setWalletsSpecs] = useStorage<StringRecord<WalletSpecs>>(WALLETS_SPECS_STORAGE_KEY, {});

  const customNetworks = useMemo(() => settings?.customNetworks ?? [], [settings]);
  const networks = useMemo(() => [...defaultNetworks, ...customNetworks], [defaultNetworks, customNetworks]);

  /**
   * Actions
   */

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

  const findFreeHdIndex = useCallback(async (walletId: string) => {
    const res = await request({
      type: TempleMessageType.FindFreeHDAccountIndexRequest,
      walletId
    });
    assertResponse(res.type === TempleMessageType.FindFreeHDAccountIndexResponse);
    return omit(res, 'type');
  }, []);

  const createAccount = useCallback(async (walletId: string, name?: string) => {
    const res = await request({
      type: TempleMessageType.CreateAccountRequest,
      name,
      walletId
    });
    assertResponse(res.type === TempleMessageType.CreateAccountResponse);
  }, []);

  const revealPrivateKey = useCallback(async (accountPublicKeyHash: string, password: string) => {
    const res = await request({
      type: TempleMessageType.RevealPrivateKeyRequest,
      accountPublicKeyHash,
      password
    });
    assertResponse(res.type === TempleMessageType.RevealPrivateKeyResponse);
    return res.privateKey;
  }, []);

  const revealMnemonic = useCallback(async (walletId: string, password: string) => {
    const res = await request({
      type: TempleMessageType.RevealMnemonicRequest,
      walletId,
      password
    });
    assertResponse(res.type === TempleMessageType.RevealMnemonicResponse);
    return res.mnemonic;
  }, []);

  const generateSyncPayload = useCallback(async (password: string) => {
    const res = await request({
      type: TempleMessageType.GenerateSyncPayloadRequest,
      password
    });
    assertResponse(res.type === TempleMessageType.GenerateSyncPayloadResponse);
    return res.payload;
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

  const updateAccountKYCStatus = useCallback(async (accountPublicKeyHash: string, isKYC: boolean) => {
    const res = await request({
      type: TempleMessageType.UpdateKYCAccountRequest,
      accountPublicKeyHash,
      isKYC
    });
    assertResponse(res.type === TempleMessageType.UpdateKYCAccountResponse);
  }, []);

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

  const createOrImportWallet = useCallback(async (mnemonic?: string) => {
    const res = await request({
      type: TempleMessageType.CreateOrImportWalletRequest,
      mnemonic
    });
    assertResponse(res.type === TempleMessageType.CreateOrImportWalletResponse);
  }, []);

  const editHdGroupName = useCallback(
    (id: string, name: string) =>
      setWalletsSpecs(prevSpecs => ({
        ...prevSpecs,
        [id]: {
          ...prevSpecs[id],
          name: name.trim()
        }
      })),
    [setWalletsSpecs]
  );

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

  const getDAppPayload = useCallback(async (id: string, token: string) => {
    const res = await request({
      type: TempleMessageType.DAppGetPayloadRequest,
      id,
      token
    });
    assertResponse(res.type === TempleMessageType.DAppGetPayloadResponse);
    return res.payload;
  }, []);

  const confirmDAppPermission = useCallback(async (id: string, confirmed: boolean, pkh: string) => {
    const res = await request({
      type: TempleMessageType.DAppPermConfirmationRequest,
      id,
      confirmed,
      accountPublicKeyHash: pkh,
      accountPublicKey: confirmed ? await getPublicKey(pkh) : ''
    });
    assertResponse(res.type === TempleMessageType.DAppPermConfirmationResponse);
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

  const createWebMavrykWallet = useCallback(
    (sourcePkh: string, networkRpc: string) =>
      new WebMavrykWallet(sourcePkh, networkRpc, {
        onBeforeSend: id => {
          confirmationIdRef.current = id;
          walletStore.getState().setConfirmationId(id);
        }
      }),
    []
  );

  const createWebMavrykSigner = useCallback(
    (sourcePkh: string) =>
      new TempleSigner(sourcePkh, id => {
        confirmationIdRef.current = id;
        walletStore.getState().setConfirmationId(id);
      }),
    []
  );

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

  return {
    state,

    // Aliases
    status,
    defaultNetworks,
    customNetworks,
    networks,
    walletsSpecs,
    accounts,
    settings,
    idle,
    locked,
    ready,

    // Misc
    confirmation,
    resetConfirmation,

    // Actions
    registerWallet,
    unlock,
    lock,
    createAccount,
    revealPrivateKey,
    revealMnemonic,
    generateSyncPayload,
    removeAccount,
    editAccountName,
    findFreeHdIndex,
    updateAccountKYCStatus,
    importAccount,
    importMnemonicAccount,
    importFundraiserAccount,
    importKTManagedAccount,
    importWatchOnlyAccount,
    createLedgerAccount,
    updateSettings,
    removeHdGroup,
    removeAccountsByType,
    createOrImportWallet,
    editHdGroupName,
    confirmInternal,
    getDAppPayload,
    confirmDAppPermission,
    confirmDAppOperation,
    confirmDAppSign,
    createWebMavrykWallet,
    createWebMavrykSigner,
    getAllDAppSessions,
    removeAllDAppSessions,
    removeDAppSession
  };
};

export const [
  TempleClientProvider,
  useTempleState,
  useTempleWallet,
  useTempleAccounts,
  useTempleImport,
  useTempleDApp,
  useTempleConfirm,
  useTempleSigner,
  useTempleSettings
] = constate(
  useTempleClientImpl,
  v => ({
    state: v.state,
    status: v.status,
    defaultNetworks: v.defaultNetworks,
    customNetworks: v.customNetworks,
    networks: v.networks,
    walletsSpecs: v.walletsSpecs,
    accounts: v.accounts,
    settings: v.settings,
    idle: v.idle,
    locked: v.locked,
    ready: v.ready
  }),
  v => ({
    registerWallet: v.registerWallet,
    unlock: v.unlock,
    lock: v.lock,
    createAccount: v.createAccount,
    revealPrivateKey: v.revealPrivateKey,
    revealMnemonic: v.revealMnemonic,
    generateSyncPayload: v.generateSyncPayload,
    updateAccountKYCStatus: v.updateAccountKYCStatus
  }),
  v => ({ removeAccount: v.removeAccount, editAccountName: v.editAccountName, findFreeHdIndex: v.findFreeHdIndex }),
  v => ({
    importAccount: v.importAccount,
    importMnemonicAccount: v.importMnemonicAccount,
    importFundraiserAccount: v.importFundraiserAccount,
    importKTManagedAccount: v.importKTManagedAccount,
    importWatchOnlyAccount: v.importWatchOnlyAccount,
    createLedgerAccount: v.createLedgerAccount,
    createOrImportWallet: v.createOrImportWallet
  }),
  v => ({
    getAllDAppSessions: v.getAllDAppSessions,
    removeAllDAppSessions: v.removeAllDAppSessions,
    removeDAppSession: v.removeDAppSession,
    confirmDAppPermission: v.confirmDAppPermission,
    confirmDAppOperation: v.confirmDAppOperation,
    confirmDAppSign: v.confirmDAppSign,
    getDAppPayload: v.getDAppPayload
  }),
  v => ({ confirmation: v.confirmation, resetConfirmation: v.resetConfirmation, confirmInternal: v.confirmInternal }),
  v => ({ createWebMavrykWallet: v.createWebMavrykWallet, createWebMavrykSigner: v.createWebMavrykSigner }),
  v => ({
    updateSettings: v.updateSettings,
    removeHdGroup: v.removeHdGroup,
    removeAccountsByType: v.removeAccountsByType,
    editHdGroupName: v.editHdGroupName
  })
);

/** Backwards-compatible shim — keeps all existing consumers working without changes. */
export const useTempleClient = () => ({
  ...useTempleState(),
  ...useTempleWallet(),
  ...useTempleAccounts(),
  ...useTempleImport(),
  ...useTempleDApp(),
  ...useTempleConfirm(),
  ...useTempleSigner(),
  ...useTempleSettings()
});

type WebMavrykWalletOps = {
  onBeforeSend?: (id: string) => void;
};

export const createStakeOperation = ({ source, amount, fee, gasLimit, storageLimit }: StakeParams) => {
  return Promise.resolve({
    kind: 'stake',
    source,
    fee,
    gas_limit: gasLimit,
    storage_limit: storageLimit,
    amount
  });
};

export const createUnstakeOperation = ({ source, amount, fee, gasLimit, storageLimit }: UnstakeParams) => {
  return Promise.resolve({
    kind: 'unstake',
    source,
    fee,
    gas_limit: gasLimit,
    storage_limit: storageLimit,
    amount
  });
};

export const createFinalizeUnstakeOperation = ({ source, fee, gasLimit, storageLimit }: FinalizeUnstakeParams) => {
  return Promise.resolve({
    kind: 'finalize_unstake',
    source,
    fee,
    gas_limit: gasLimit,
    storage_limit: storageLimit
  });
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
    // WalletDelegateParams intentionally omits `source` (WalletDefinedFields); the SDK
    // fills it from the active account. Cast to internal DelegateParams is safe here.
    return withoutFeesOverride(walletParams, await createSetDelegateOperation(walletParams as unknown as DelegateParams));
  }

  // ---- staking methods ----
  async mapStakeParamsToWalletParams(params: () => Promise<WalletStakeParams>) {
    const walletParams = await params();
    // WalletStakeParams has `to?: string` (optional) but createTransferOperation requires
    // `to: string`. The SDK fills `to` with the pseudo-operation address at runtime.
    return withoutFeesOverride(walletParams, await createTransferOperation(walletParams as unknown as TransferParams));
  }

  async mapUnstakeParamsToWalletParams(params: () => Promise<WalletUnstakeParams>) {
    const walletParams = await params();
    // Same structural gap: `to` is optional in WalletUnstakeParams, required in TransferParams.
    return withoutFeesOverride(walletParams, await createTransferOperation(walletParams as unknown as TransferParams));
  }

  async mapFinalizeUnstakeParamsToWalletParams(params: () => Promise<WalletFinalizeUnstakeParams>) {
    const walletParams = await params();
    // Same structural gap: `to` is optional in WalletFinalizeUnstakeParams, required in TransferParams.
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
        mumav: true // The balance was already converted from Mav (ꝳ) to Mumav (uꝳ)
      };
    case 'transaction':
      const { destination, amount, parameters, ...txRest } = op;
      return {
        ...txRest,
        to: destination,
        amount: +amount,
        mumav: true,
        parameter: parameters
      };
    default:
      return op;
  }
}

async function getPublicKey(accountPublicKeyHash: string) {
  const res = await request({
    type: TempleMessageType.RevealPublicKeyRequest,
    accountPublicKeyHash
  });
  assertResponse(res.type === TempleMessageType.RevealPublicKeyResponse);
  return res.publicKey;
}

export async function request<T extends TempleRequest>(req: T) {
  const res = await intercom.request(req);
  assertResponse('type' in res);
  return res as TempleResponse;
}

export function assertResponse(condition: any): asserts condition {
  if (!condition) {
    throw new Error('Invalid response recieved');
  }
}

function withoutFeesOverride<T>(params: any, op: T): T {
  // L5: re-throw on error — swallowing here would silently return wrong params and corrupt wallet ops.
  const { fee, gasLimit, storageLimit } = params;
  return {
    ...op,
    fee,
    gas_limit: gasLimit,
    storage_limit: storageLimit
  };
}
