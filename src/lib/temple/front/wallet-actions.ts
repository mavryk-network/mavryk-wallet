import { useCallback } from 'react';

import { omit } from 'lodash';

import { clearLocalStorage } from 'lib/temple/reset';
import {
  TempleMessageType,
  TempleSettings,
  TempleChainKind,
  TempleAccountType,
  SaveLedgerAccountInput
} from 'lib/temple/types';

import { request, assertResponse } from './client';

/**
 * Focused wallet action hooks.
 *
 * Each hook wraps a single Intercom request to the background service worker.
 * These replace the 24+ action callbacks bundled in useTempleClient().
 *
 * Benefits over the god object:
 * - Tree-shakeable: only imported actions are bundled
 * - Granular: components don't re-render when unrelated state changes
 * - Testable: each action is independently mockable
 *
 * Phase 5b: Created alongside useTempleClient. Consumers will migrate gradually.
 */

export function useRegisterWallet() {
  return useCallback(async (password: string, mnemonic?: string) => {
    const res = await request({
      type: TempleMessageType.NewWalletRequest,
      password,
      mnemonic
    });
    assertResponse(res.type === TempleMessageType.NewWalletResponse);
    clearLocalStorage(['onboarding', 'analytics']);
    return res.accountPkh;
  }, []);
}

export function useUnlock() {
  return useCallback(async (password: string) => {
    const res = await request({
      type: TempleMessageType.UnlockRequest,
      password
    });
    assertResponse(res.type === TempleMessageType.UnlockResponse);
  }, []);
}

export function useLock() {
  return useCallback(async () => {
    const res = await request({
      type: TempleMessageType.LockRequest
    });
    assertResponse(res.type === TempleMessageType.LockResponse);
  }, []);
}

export function useFindFreeHdIndex() {
  return useCallback(async (walletId: string) => {
    const res = await request({
      type: TempleMessageType.FindFreeHDAccountIndexRequest,
      walletId
    });
    assertResponse(res.type === TempleMessageType.FindFreeHDAccountIndexResponse);
    return omit(res, 'type');
  }, []);
}

export function useCreateAccount() {
  return useCallback(async (walletId: string, name?: string) => {
    const res = await request({
      type: TempleMessageType.CreateAccountRequest,
      name,
      walletId
    });
    assertResponse(res.type === TempleMessageType.CreateAccountResponse);
  }, []);
}

export function useRevealPrivateKey() {
  return useCallback(async (accountPublicKeyHash: string, password: string) => {
    const res = await request({
      type: TempleMessageType.RevealPrivateKeyRequest,
      accountPublicKeyHash,
      password
    });
    assertResponse(res.type === TempleMessageType.RevealPrivateKeyResponse);
    return res.privateKey;
  }, []);
}

export function useRevealMnemonic() {
  return useCallback(async (walletId: string, password: string) => {
    const res = await request({
      type: TempleMessageType.RevealMnemonicRequest,
      walletId,
      password
    });
    assertResponse(res.type === TempleMessageType.RevealMnemonicResponse);
    return res.mnemonic;
  }, []);
}

export function useGenerateSyncPayload() {
  return useCallback(async (password: string) => {
    const res = await request({
      type: TempleMessageType.GenerateSyncPayloadRequest,
      password
    });
    assertResponse(res.type === TempleMessageType.GenerateSyncPayloadResponse);
    return res.payload;
  }, []);
}

export function useRemoveAccount() {
  return useCallback(async (accountPublicKeyHash: string, password: string) => {
    const res = await request({
      type: TempleMessageType.RemoveAccountRequest,
      accountPublicKeyHash,
      password
    });
    assertResponse(res.type === TempleMessageType.RemoveAccountResponse);
  }, []);
}

export function useEditAccountName() {
  return useCallback(async (accountPublicKeyHash: string, name: string) => {
    const res = await request({
      type: TempleMessageType.EditAccountRequest,
      accountPublicKeyHash,
      name
    });
    assertResponse(res.type === TempleMessageType.EditAccountResponse);
  }, []);
}

export function useUpdateAccountKYCStatus() {
  return useCallback(async (accountPublicKeyHash: string, isKYC: boolean) => {
    const res = await request({
      type: TempleMessageType.UpdateKYCAccountRequest,
      accountPublicKeyHash,
      isKYC
    });
    assertResponse(res.type === TempleMessageType.UpdateKYCAccountResponse);
  }, []);
}

export function useImportAccount() {
  return useCallback(async (privateKey: string, chainId: string, encPassword?: string) => {
    const res = await request({
      type: TempleMessageType.ImportAccountRequest,
      privateKey,
      chainId,
      encPassword,
      chain: TempleChainKind.Tezos
    });
    assertResponse(res.type === TempleMessageType.ImportAccountResponse);
  }, []);
}

export function useImportMnemonicAccount() {
  return useCallback(async (mnemonic: string, chainId: string, password?: string, derivationPath?: string) => {
    const res = await request({
      type: TempleMessageType.ImportMnemonicAccountRequest,
      mnemonic,
      password,
      chainId,
      derivationPath
    });
    assertResponse(res.type === TempleMessageType.ImportMnemonicAccountResponse);
  }, []);
}

export function useImportFundraiserAccount() {
  return useCallback(async (email: string, password: string, mnemonic: string, chainId: string) => {
    const res = await request({
      type: TempleMessageType.ImportFundraiserAccountRequest,
      email,
      password,
      mnemonic,
      chainId
    });
    assertResponse(res.type === TempleMessageType.ImportFundraiserAccountResponse);
  }, []);
}

export function useImportKTManagedAccount() {
  return useCallback(async (address: string, chainId: string, owner: string) => {
    const res = await request({
      type: TempleMessageType.ImportManagedKTAccountRequest,
      address,
      chainId,
      owner
    });
    assertResponse(res.type === TempleMessageType.ImportManagedKTAccountResponse);
  }, []);
}

export function useImportWatchOnlyAccount() {
  return useCallback(async (address: string, chainId?: string, name?: string) => {
    const res = await request({
      type: TempleMessageType.ImportWatchOnlyAccountRequest,
      address,
      chainId,
      name,
      chain: TempleChainKind.Tezos
    });
    assertResponse(res.type === TempleMessageType.ImportWatchOnlyAccountResponse);
  }, []);
}

export function useCreateLedgerAccount() {
  return useCallback(async (input: SaveLedgerAccountInput) => {
    const res = await request({
      type: TempleMessageType.CreateLedgerAccountRequest,
      input
    });
    assertResponse(res.type === TempleMessageType.CreateLedgerAccountResponse);
  }, []);
}

export function useUpdateSettings() {
  return useCallback(async (newSettings: Partial<TempleSettings>) => {
    const res = await request({
      type: TempleMessageType.UpdateSettingsRequest,
      settings: newSettings
    });
    assertResponse(res.type === TempleMessageType.UpdateSettingsResponse);
  }, []);
}

export function useRemoveHdGroup() {
  return useCallback(async (id: string, password: string) => {
    const res = await request({
      type: TempleMessageType.RemoveHdWalletRequest,
      id,
      password
    });
    assertResponse(res.type === TempleMessageType.RemoveHdWalletResponse);
  }, []);
}

export function useRemoveAccountsByType() {
  return useCallback(async (type: Exclude<TempleAccountType, TempleAccountType.HD>, password: string) => {
    const res = await request({
      type: TempleMessageType.RemoveAccountsByTypeRequest,
      accountsType: type,
      password
    });
    assertResponse(res.type === TempleMessageType.RemoveAccountsByTypeResponse);
  }, []);
}

export function useCreateOrImportWallet() {
  return useCallback(async (mnemonic?: string) => {
    const res = await request({
      type: TempleMessageType.CreateOrImportWalletRequest,
      mnemonic
    });
    assertResponse(res.type === TempleMessageType.CreateOrImportWalletResponse);
  }, []);
}

export function useConfirmInternal() {
  return useCallback(
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
}

export function useGetDAppPayload() {
  return useCallback(async (id: string, token: string) => {
    const res = await request({
      type: TempleMessageType.DAppGetPayloadRequest,
      id,
      token
    });
    assertResponse(res.type === TempleMessageType.DAppGetPayloadResponse);
    return res.payload;
  }, []);
}

export function useConfirmDAppPermission() {
  return useCallback(async (id: string, confirmed: boolean, pkh: string) => {
    const res = await request({
      type: TempleMessageType.DAppPermConfirmationRequest,
      id,
      confirmed,
      accountPublicKeyHash: pkh,
      accountPublicKey: confirmed ? await getPublicKey(pkh) : ''
    });
    assertResponse(res.type === TempleMessageType.DAppPermConfirmationResponse);
  }, []);
}

export function useConfirmDAppOperation() {
  return useCallback(
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
}

export function useConfirmDAppSign() {
  return useCallback(async (id: string, confirmed: boolean) => {
    const res = await request({
      type: TempleMessageType.DAppSignConfirmationRequest,
      id,
      confirmed
    });
    assertResponse(res.type === TempleMessageType.DAppSignConfirmationResponse);
  }, []);
}

export function useGetAllDAppSessions() {
  return useCallback(async () => {
    const res = await request({
      type: TempleMessageType.DAppGetAllSessionsRequest
    });
    assertResponse(res.type === TempleMessageType.DAppGetAllSessionsResponse);
    return res.sessions;
  }, []);
}

export function useRemoveAllDAppSessions() {
  return useCallback(async (origins: string[]) => {
    const res = await request({
      type: TempleMessageType.DAppRemoveAllSessionsRequest,
      origins
    });
    assertResponse(res.type === TempleMessageType.DAppRemoveAllSessionsResponse);
    return res.sessions;
  }, []);
}

export function useRemoveDAppSession() {
  return useCallback(async (origin: string) => {
    const res = await request({
      type: TempleMessageType.DAppRemoveSessionRequest,
      origin
    });
    assertResponse(res.type === TempleMessageType.DAppRemoveSessionResponse);
    return res.sessions;
  }, []);
}

async function getPublicKey(accountPublicKeyHash: string) {
  const res = await request({
    type: TempleMessageType.RevealPublicKeyRequest,
    accountPublicKeyHash
  });
  assertResponse(res.type === TempleMessageType.RevealPublicKeyResponse);
  return res.publicKey;
}
