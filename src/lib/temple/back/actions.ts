import {
  MavrykWalletDAppMessageType,
  MavrykWalletDAppErrorType,
  MavrykWalletDAppRequest,
  MavrykWalletDAppResponse
} from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import { MavrykOperationError } from '@mavrykdynamics/webmavryk';
import browser, { Runtime } from 'webextension-polyfill';

import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';
import { BACKGROUND_IS_WORKER } from 'lib/env';
import { addLocalOperation } from 'lib/temple/activity';
import {
  buildAuthWalletAddressesMap,
  canAccountSignAuth,
  loadChainId,
  resolveAuthWalletAddress
} from 'lib/temple/helpers';
import { sumOperationFeesMumav } from 'lib/temple/operation-fee.helpers';
import {
  DerivationType,
  TempleState,
  TempleMessageType,
  TempleRequest,
  TempleSettings,
  TempleSharedStorageKey,
  TempleChainKind,
  SaveLedgerAccountInput,
  TempleAccountType,
  TempleAccount,
  TempleStatus
} from 'lib/temple/types';
import { createQueue, delay } from 'lib/utils';
import {
  clearStoredAuthTokens,
  getAuthTokensFromStorage,
  getSelectedNetworkIdFromStorage,
  isJwtExpiringSoon,
  logoutAuth,
  refreshAuthTokens,
  requestAuthChallenge,
  verifyAuthSignature
} from 'mavryk/api';
import { toSafeLogError } from 'mavryk/api/errors';
import { setAuthWalletAddressesMapToStorage } from 'mavryk/api/storage';
import { signAuthChallengeWithVault } from 'mavryk/api/utils';

import { shouldPerformInteractiveAuthChallenge } from './auth.helpers';
import { IN_WALLET_CONFIRMATION_AUTODECLINE_MS, JWT_EXPIRING_SOON_THRESHOLD_MS } from './constants';
import {
  getCurrentPermission,
  requestPermission,
  requestOperation,
  requestSign,
  requestBroadcast,
  getAllDApps,
  removeDApp,
  removeAllDApps,
  removeDAppSessionsForPkhs
} from './dapp';
import { DAppContactsResponse, isDAppContactsRequest, processDAppContactsRequest } from './dapp-contacts';
import { enqueueDApp, enqueueDAppForOrigin } from './dapp-queue';
import { createDecisionGate } from './decision-gate';
import { intercom } from './defaults';
import type { DryRunResult } from './dryrun';
import { buildFinalOpParmas, dryRunOpParams } from './dryrun';
import { assertExtensionUiPortInfo } from './intercom-permissions';
import { createLockCoordinator, shouldLockOnSessionRecovery } from './lock-coordination';
import {
  toFront,
  store,
  inited,
  locked,
  unlocked,
  accountsUpdated,
  settingsUpdated,
  withInited,
  withUnlocked
} from './store';
import { isTrustedNexusOrigin } from './trusted-origin.helpers';
import { Vault } from './vault';

export const ACCOUNT_NAME_PATTERN_STR = '^(?! )[\\p{L}\\p{N}\\p{Emoji} .\\-]{1,100}(?<! )$';
export const ACCOUNT_NAME_PATTERN = new RegExp(ACCOUNT_NAME_PATTERN_STR, 'u');
const ACCOUNT_OR_GROUP_NAME_PATTERN = /^[^!@#$%^&*()_+\-=\]{};':"\\|,.<>?]{1,16}$/;

let initLocked = false;

const enqueueUnlock = createQueue();
const { waitForLocks, unlockAfterLocks, ...lockActions } = createLockCoordinator(lockWallet);
export const { lock, enforceAutolock, enforceAutolockOnPageOpen } = lockActions;

const findNewAccount = (prev: TempleAccount[], next: TempleAccount[]) => {
  const prevIds = new Set(prev.map(acc => acc.id));
  return next.find(acc => !prevIds.has(acc.id));
};

const syncAuthWalletAddresses = (accounts: TempleAccount[]) =>
  setAuthWalletAddressesMapToStorage(buildAuthWalletAddressesMap(accounts));

const updateAccountsAndSyncAuth = async (accounts: TempleAccount[]) => {
  accountsUpdated(accounts);
  await syncAuthWalletAddresses(accounts);
};

const removeDAppSessionsOfRemovedAccounts = (prevAccounts: TempleAccount[], newAccounts: TempleAccount[]) => {
  const remainingPkhs = new Set(newAccounts.map(acc => acc.publicKeyHash));

  return removeDAppSessionsForPkhs(prevAccounts.map(acc => acc.publicKeyHash).filter(pkh => !remainingPkhs.has(pkh)));
};

// Sweeps sessions orphaned by account removals made before removal clean-up existed (or any later drift),
// so a re-imported or re-derived pkh never inherits an old dApp session without a new prompt.
const removeOrphanedDAppSessions = async (accounts: TempleAccount[]) => {
  try {
    const accountPkhs = new Set(accounts.map(acc => acc.publicKeyHash));
    const sessions = Object.values(await getAllDApps());

    await removeDAppSessionsForPkhs(sessions.map(session => session.pkh).filter(pkh => !accountPkhs.has(pkh)));
  } catch (err) {
    console.error(err);
  }
};

const setupUnlockedVaultState = async (password: string) => {
  const vault = await Vault.setup(password, BACKGROUND_IS_WORKER);
  const [accounts, settings] = await Promise.all([vault.fetchAccounts(), vault.fetchSettings()]);
  await syncAuthWalletAddresses(accounts);
  await removeOrphanedDAppSessions(accounts);

  return { vault, accounts, settings };
};

const getStoredSelectedAccountPkh = async () => {
  const { [ACCOUNT_PKH_STORAGE_KEY]: selectedAccountPkh } = await browser.storage.local.get(ACCOUNT_PKH_STORAGE_KEY);

  return typeof selectedAccountPkh === 'string' ? selectedAccountPkh : undefined;
};

const resolveAuthWalletAddressForRequest = (
  allAccounts: TempleAccount[],
  accountPkh?: string | null,
  explicitAuthWalletAddress?: string | null
) => {
  if (!explicitAuthWalletAddress) {
    return resolveAuthWalletAddress(allAccounts, accountPkh);
  }

  const authAccount = allAccounts.find(account => account.publicKeyHash === explicitAuthWalletAddress);

  return authAccount && canAccountSignAuth(authAccount) ? explicitAuthWalletAddress : null;
};

const performAuthForAccount = async (
  vault: Vault,
  accountPkh: string,
  accounts?: TempleAccount[],
  networkId?: string,
  explicitAuthWalletAddress?: string
) => {
  const allAccounts = accounts ?? (await vault.fetchAccounts());
  const authWalletAddress = resolveAuthWalletAddressForRequest(allAccounts, accountPkh, explicitAuthWalletAddress);

  if (!authWalletAddress) {
    return;
  }

  const { nonce, challenge } = await requestAuthChallenge({ walletAddress: authWalletAddress, networkId });
  const signature = await signAuthChallengeWithVault(vault, authWalletAddress, challenge);
  await verifyAuthSignature({ nonce, signature, walletAddress: authWalletAddress, networkId });
};

const ensureAuthorizedForAccount = async (
  vault: Vault,
  accountPkh?: string,
  networkId?: string,
  accounts?: TempleAccount[],
  interactive = true,
  explicitAuthWalletAddress?: string
) => {
  const allAccounts = accounts ?? (await vault.fetchAccounts());
  const authWalletAddress = resolveAuthWalletAddressForRequest(allAccounts, accountPkh, explicitAuthWalletAddress);

  if (!authWalletAddress) {
    return;
  }

  const { accessToken } = await getAuthTokensFromStorage({ walletAddress: authWalletAddress, networkId });

  if (accessToken && !isJwtExpiringSoon(accessToken, JWT_EXPIRING_SOON_THRESHOLD_MS)) {
    return;
  }

  try {
    await refreshAuthTokens({ networkId, walletAddress: authWalletAddress });
    return;
  } catch {
    if (!shouldPerformInteractiveAuthChallenge(allAccounts, authWalletAddress, interactive)) {
      return;
    }

    await performAuthForAccount(vault, authWalletAddress, allAccounts, networkId, explicitAuthWalletAddress);
  }
};

export async function init() {
  const vaultExist = await Vault.isExist();
  inited(vaultExist);

  if (initLocked) {
    initLocked = false;
    locked();
  }
}

export async function getFrontState(): Promise<TempleState> {
  const state = store.getState();
  if (state.inited) {
    if (BACKGROUND_IS_WORKER) return await enqueueUnlock(async () => toFront(store.getState()));
    else return toFront(state);
  } else {
    await delay(10);

    return getFrontState();
  }
}

export async function isDAppEnabled() {
  const bools = await Promise.all([
    Vault.isExist(),
    (async () => {
      const key = TempleSharedStorageKey.DAppEnabled;
      const items = await browser.storage.local.get([key]);
      return key in items ? items[key] : true;
    })()
  ]);

  return bools.every(Boolean);
}

export function registerNewWallet(password: string, mnemonic?: string) {
  return withInited(() =>
    enqueueUnlock(async () => {
      const accountPkh = await Vault.spawn(password, mnemonic);
      // Auth runs inside the guarded setup, so a lock landing during its network calls still aborts the creation
      const { state: unlockedState } = await unlockAfterLocks(async isInterruptedByLock => {
        const state = await setupUnlockedVaultState(password);
        if (!isInterruptedByLock()) await performAuthForAccount(state.vault, accountPkh, state.accounts);
        return state;
      });
      unlocked(unlockedState);

      return accountPkh;
    })
  );
}

async function lockWallet() {
  if (!store.getState().inited) initLocked = true;
  try {
    // Only the local token clean-up holds the lock; a stalled /auth/logout must not keep the vault unlocked
    await logoutAuth({}, { awaitRevocation: false });
  } catch (err) {
    console.error(err);
  }
  if (BACKGROUND_IS_WORKER) await Vault.forgetSession();
  return withInited(() => {
    locked();
  });
}

export function unlock(password: string) {
  return withInited(() =>
    enqueueUnlock(async () => {
      const { state: unlockedState, isInterruptedByLock } = await unlockAfterLocks(() =>
        setupUnlockedVaultState(password)
      );
      const { vault, accounts } = unlockedState;
      unlocked(unlockedState);

      const [selectedAccountPkh, networkId] = await Promise.all([
        getStoredSelectedAccountPkh(),
        getSelectedNetworkIdFromStorage()
      ]);
      if (isInterruptedByLock()) return;

      try {
        await ensureAuthorizedForAccount(vault, selectedAccountPkh, networkId, accounts);
      } catch (error) {
        console.error(toSafeLogError(error));
      }

      // A lock landing during the auth calls logged out first, so the tokens the auth saved after it are cleared again
      if (isInterruptedByLock()) await lock();
    })
  );
}

export async function unlockFromSession() {
  await enqueueUnlock(async () => {
    const isInterruptedByLock = await waitForLocks();
    const recovered = await Vault.recoverFromSession();
    if (recovered == null) return;

    if (await shouldLockOnSessionRecovery()) {
      await lock();
      return;
    }

    const { vault, accounts } = recovered;
    const settings = await vault.fetchSettings();
    await enforceAutolock();
    if (isInterruptedByLock()) return;
    unlocked({ vault, accounts, settings });
    await syncAuthWalletAddresses(accounts);
    await removeOrphanedDAppSessions(accounts);
  });
}

/**
 * Clears every stored auth token when the background has started with the wallet locked.
 * After a browser restart `storage.session` is wiped, so the vault comes back locked and `unlockFromSession`
 * recovers nothing, while the long-lived refresh token would otherwise stay on disk until the next unlock.
 * Local only: no revocation request at startup, and the next unlock authenticates again.
 * Runs in the unlock queue so it never clears tokens written by an unlock that started meanwhile.
 */
export function clearAuthTokensIfStartedLocked() {
  return enqueueUnlock(async () => {
    if (store.getState().status === TempleStatus.Ready) return;
    await clearStoredAuthTokens();
  });
}

export function findFreeHDAccountIndex(walletId: string) {
  return withUnlocked(({ vault }) => vault.findFreeHDAccountIndex(walletId));
}

export function createHDAccount(walletId: string, name?: string, hdIndex?: number) {
  return withUnlocked(async ({ vault }) => {
    if (name) {
      name = name.trim();
      if (!ACCOUNT_OR_GROUP_NAME_PATTERN.test(name)) {
        throw new Error('Invalid name. It should be 1-16 characters');
      }
    }

    const prevAccounts = await vault.fetchAccounts();
    const updatedAccounts = await vault.createHDAccount(walletId, name, hdIndex);
    await updateAccountsAndSyncAuth(updatedAccounts);
    const newAccount = findNewAccount(prevAccounts, updatedAccounts);
    if (newAccount) {
      await performAuthForAccount(vault, newAccount.publicKeyHash, updatedAccounts);
    }
  });
}

export function revealMnemonic(walletId: string, password: string) {
  return withUnlocked(() => Vault.revealMnemonic(walletId, password));
}

export function generateSyncPayload(password: string) {
  return withUnlocked(() => Vault.generateSyncPayload(password));
}

export function revealPrivateKey(accPublicKeyHash: string, password: string) {
  return withUnlocked(() => Vault.revealPrivateKey(accPublicKeyHash, password));
}

export function revealPublicKey(accPublicKeyHash: string) {
  return withUnlocked(({ vault }) => vault.revealPublicKey(accPublicKeyHash));
}

export function deriveContactsKey(accPublicKeyHash: string) {
  return withUnlocked(({ vault }) => vault.deriveContactsKey(accPublicKeyHash));
}

export function removeAccount(id: string, password: string) {
  return withUnlocked(async ({ vault }) => {
    try {
      await logoutAuth();
    } catch (err) {
      console.error(err);
    }
    const prevAccounts = await vault.fetchAccounts();
    const { newAccounts } = await Vault.removeAccount(id, password);
    await updateAccountsAndSyncAuth(newAccounts);
    await removeDAppSessionsOfRemovedAccounts(prevAccounts, newAccounts);
  });
}

export function editAccount(accPublicKeyHash: string, name: string) {
  return withUnlocked(async ({ vault }) => {
    name = name.trim();
    if (!ACCOUNT_NAME_PATTERN.test(name)) {
      throw new Error('Invalid name. It should be: 1-16 characters, without special');
    }

    const updatedAccounts = await vault.editAccountName(accPublicKeyHash, name);
    accountsUpdated(updatedAccounts);
  });
}

export function updateAccountKYC(accPublicKeyHash: string, isKYC: boolean) {
  return withUnlocked(async ({ vault }) => {
    const updatedAccounts = await vault.updateAccountKYCStatus(accPublicKeyHash, isKYC);
    await updateAccountsAndSyncAuth(updatedAccounts);
  });
}

export function importAccount(chainId: string, chain: TempleChainKind, privateKey: string, encPassword?: string) {
  return withUnlocked(async ({ vault }) => {
    const prevAccounts = await vault.fetchAccounts();
    const updatedAccounts = await vault.importAccount(chain, chainId, privateKey, encPassword);
    await updateAccountsAndSyncAuth(updatedAccounts);
    const newAccount = findNewAccount(prevAccounts, updatedAccounts);
    if (newAccount) {
      await performAuthForAccount(vault, newAccount.publicKeyHash, updatedAccounts);
    }
  });
}

export function importMnemonicAccount(mnemonic: string, chainId: string, password?: string, derivationPath?: string) {
  return withUnlocked(async ({ vault }) => {
    const prevAccounts = await vault.fetchAccounts();
    const updatedAccounts = await vault.importMnemonicAccount(mnemonic, chainId, password, derivationPath);
    await updateAccountsAndSyncAuth(updatedAccounts);
    const newAccount = findNewAccount(prevAccounts, updatedAccounts);
    if (newAccount) {
      await performAuthForAccount(vault, newAccount.publicKeyHash, updatedAccounts);
    }
  });
}

export function importFundraiserAccount(email: string, password: string, mnemonic: string, chainId: string) {
  return withUnlocked(async ({ vault }) => {
    const updatedAccounts = await vault.importFundraiserAccount(email, password, mnemonic, chainId);
    await updateAccountsAndSyncAuth(updatedAccounts);
  });
}

export function importManagedKTAccount(address: string, chainId: string, owner: string) {
  return withUnlocked(async ({ vault }) => {
    const updatedAccounts = await vault.importManagedKTAccount(address, chainId, owner);
    await updateAccountsAndSyncAuth(updatedAccounts);
  });
}

export function importWatchOnlyAccount(address: string, chain: TempleChainKind, chainId?: string, name?: string) {
  return withUnlocked(async ({ vault }) => {
    const prevAccounts = await vault.fetchAccounts();
    const updatedAccounts = await vault.importWatchOnlyAccount(chain, address, chainId, name);
    await updateAccountsAndSyncAuth(updatedAccounts);
    const newAccount = findNewAccount(prevAccounts, updatedAccounts);
    if (newAccount) {
      await performAuthForAccount(vault, newAccount.publicKeyHash, updatedAccounts);
    }
  });
}

export function getLedgerTezosPk(derivationPath?: string, derivationType?: DerivationType) {
  return withUnlocked(async ({ vault }) => await vault.getLedgerTezosPk(derivationPath, derivationType));
}

export function createLedgerAccount(input: SaveLedgerAccountInput) {
  return withUnlocked(async ({ vault }) => {
    const updatedAccounts = await vault.createLedgerAccount(input);
    await updateAccountsAndSyncAuth(updatedAccounts);
  });
}

export function updateSettings(settings: Partial<TempleSettings>) {
  return withUnlocked(async ({ vault }) => {
    const updatedSettings = await vault.updateSettings(settings);
    createCustomNetworksSnapshot(updatedSettings);
    settingsUpdated(updatedSettings);
  });
}

export function removeHdWallet(id: string, password: string) {
  return withUnlocked(async ({ vault }) => {
    try {
      await logoutAuth();
    } catch (err) {
      console.error(err);
    }
    const prevAccounts = await vault.fetchAccounts();
    const { newAccounts } = await Vault.removeHdWallet(id, password);
    await updateAccountsAndSyncAuth(newAccounts);
    await removeDAppSessionsOfRemovedAccounts(prevAccounts, newAccounts);
  });
}

export function removeAccountsByType(type: Exclude<TempleAccountType, TempleAccountType.HD>, password: string) {
  return withUnlocked(async ({ vault }) => {
    try {
      await logoutAuth();
    } catch (err) {
      console.error(err);
    }
    const prevAccounts = await vault.fetchAccounts();
    const newAccounts = await Vault.removeAccountsByType(type, password);
    await updateAccountsAndSyncAuth(newAccounts);
    await removeDAppSessionsOfRemovedAccounts(prevAccounts, newAccounts);
  });
}

export function createOrImportWallet(mnemonic?: string) {
  return withUnlocked(async ({ vault }) => {
    const prevAccounts = await vault.fetchAccounts();
    const { newAccounts } = await vault.createOrImportWallet(mnemonic);
    await updateAccountsAndSyncAuth(newAccounts);
    const newAccount = findNewAccount(prevAccounts, newAccounts);
    if (newAccount) {
      await performAuthForAccount(vault, newAccount.publicKeyHash, newAccounts);
    }
  });
}

export function ensureAuthorized(
  accountPkh?: string,
  networkId?: string,
  interactive = true,
  explicitAuthWalletAddress?: string
) {
  return withUnlocked(async ({ vault }) => {
    const accounts = await vault.fetchAccounts();

    await ensureAuthorizedForAccount(vault, accountPkh, networkId, accounts, interactive, explicitAuthWalletAddress);
  });
}

export function getAllDAppSessions() {
  return getAllDApps();
}

export function removeAllDAppSessions(origins: string[]) {
  return removeAllDApps(origins);
}

export function removeDAppSession(origin: string) {
  return removeDApp(origin);
}

type SentOperationsResult = { opHash: string; feeMumav?: string };

/**
 * Builds the in-wallet send result from the injected batch.
 * `feeMumav` is the fee actually applied (reveal included, after any Minimal/Fast change in the confirmation),
 * so the success screen doesn't have to guess it. It is omitted when the batch has no preapplied contents.
 */
const toSentOperationsResult = (op: { hash: string; results?: ReadonlyArray<object> }): SentOperationsResult =>
  op.results && op.results.length > 0
    ? { opHash: op.hash, feeMumav: sumOperationFeesMumav(op.results).toFixed() }
    : { opHash: op.hash };

export function sendOperations(
  port: Runtime.Port,
  id: string,
  sourcePkh: string,
  networkRpc: string,
  opParams: any[]
): Promise<SentOperationsResult> {
  assertExtensionUiPortInfo(intercom.getPortInfo(port));

  return withUnlocked(async () => {
    const sourcePublicKey = await revealPublicKey(sourcePkh);
    const dryRunResult = await dryRunOpParams({
      opParams,
      networkRpc,
      sourcePkh,
      sourcePublicKey
    });
    if (dryRunResult && dryRunResult.result) {
      opParams = (dryRunResult.result as any).opParams;
    }

    return new Promise((resolve, reject) =>
      promisableUnlock(resolve, reject, port, id, sourcePkh, networkRpc, opParams, dryRunResult)
    );
  });
}

const promisableUnlock = async (
  resolve: (arg: SentOperationsResult) => void,
  reject: (err: Error) => void,
  port: Runtime.Port,
  id: string,
  sourcePkh: string,
  networkRpc: string,
  opParams: any[],
  dryRunResult: DryRunResult | null
) => {
  intercom.notify(port, {
    type: TempleMessageType.ConfirmationRequested,
    id,
    payload: {
      type: 'operations',
      sourcePkh,
      networkRpc,
      opParams,
      ...((dryRunResult && dryRunResult.result) ?? {})
    },
    ...(dryRunResult && dryRunResult.error ? { error: dryRunResult } : {})
  });

  let closing = false;

  const decline = () => {
    reject(new Error('Declined'));
  };
  const gate = createDecisionGate(() => {
    decline();
    closing = close(closing, port, id, stopTimeout, stopRequestListening, stopDisconnectListening);
  });

  const stopRequestListening = intercom.onRequest(async (req: TempleRequest, reqPort) => {
    if (reqPort === port && req?.type === TempleMessageType.ConfirmationRequest && req?.id === id) {
      assertExtensionUiPortInfo(intercom.getPortInfo(reqPort));
      gate.begin();

      if (req.confirmed) {
        try {
          const op = await withUnlocked(({ vault }) =>
            vault.sendOperations(
              sourcePkh,
              networkRpc,
              buildFinalOpParmas(opParams, req.modifiedTotalFee, req.modifiedStorageLimit)
            )
          );

          await safeAddLocalOperation(networkRpc, op);

          resolve(toSentOperationsResult(op));
        } catch (err: any) {
          if (err instanceof MavrykOperationError) {
            reject(err);
          } else {
            gate.release();
            throw err;
          }
        }
      } else {
        decline();
      }

      closing = close(closing, port, id, stopTimeout, stopRequestListening, stopDisconnectListening);

      return {
        type: TempleMessageType.ConfirmationResponse
      };
    }
    return undefined;
  });

  const stopDisconnectListening = intercom.onDisconnect(port, gate.declineOrDefer);

  // Decline after timeout
  const t = setTimeout(gate.declineOrDefer, IN_WALLET_CONFIRMATION_AUTODECLINE_MS);
  const stopTimeout = () => clearTimeout(t);
};

const safeAddLocalOperation = async (networkRpc: string, op: any) => {
  try {
    const chainId = await loadChainId(networkRpc);
    await addLocalOperation(chainId, op.hash, op.results);
  } catch {}
  return undefined;
};

export function sign(port: Runtime.Port, id: string, sourcePkh: string, bytes: string, watermark?: string) {
  assertExtensionUiPortInfo(intercom.getPortInfo(port));

  return withUnlocked(
    () =>
      new Promise(async (resolve, reject) => {
        intercom.notify(port, {
          type: TempleMessageType.ConfirmationRequested,
          id,
          payload: {
            type: 'sign',
            sourcePkh,
            bytes,
            watermark
          }
        });

        let closing = false;

        const decline = () => {
          reject(new Error('Declined'));
        };
        const gate = createDecisionGate(() => {
          decline();
          closing = close(closing, port, id, stopTimeout, stopRequestListening, stopDisconnectListening);
        });

        const stopRequestListening = intercom.onRequest(async (req: TempleRequest, reqPort) => {
          if (reqPort === port && req?.type === TempleMessageType.ConfirmationRequest && req?.id === id) {
            assertExtensionUiPortInfo(intercom.getPortInfo(reqPort));
            gate.begin();

            if (req.confirmed) {
              try {
                const result = await withUnlocked(({ vault }) => vault.sign(sourcePkh, bytes, watermark));
                resolve(result);
              } catch (err) {
                gate.release();
                throw err;
              }
            } else {
              decline();
            }

            closing = close(closing, port, id, stopTimeout, stopRequestListening, stopDisconnectListening);

            return {
              type: TempleMessageType.ConfirmationResponse
            };
          }
          return undefined;
        });

        const stopDisconnectListening = intercom.onDisconnect(port, gate.declineOrDefer);

        // Decline after timeout
        const t = setTimeout(gate.declineOrDefer, IN_WALLET_CONFIRMATION_AUTODECLINE_MS);
        const stopTimeout = () => clearTimeout(t);
      })
  );
}

export async function processDApp(
  origin: string,
  req: MavrykWalletDAppRequest | unknown,
  relayPort?: Runtime.Port
): Promise<MavrykWalletDAppResponse | DAppContactsResponse | void> {
  if (isDAppContactsRequest(req)) {
    if (!isTrustedNexusOrigin(origin)) {
      throw new Error(MavrykWalletDAppErrorType.NotGranted);
    }
    await enforceAutolock();

    return withInited(() =>
      enqueueDApp(async () =>
        withUnlocked(async ({ vault }) => {
          const [accounts, dApps] = await Promise.all([vault.fetchAccounts(), getAllDApps()]);

          return processDAppContactsRequest(origin, req, {
            dApp: dApps[origin],
            ensureAuthorized: (accountPublicKeyHash, networkId, explicitAuthWalletAddress) =>
              ensureAuthorizedForAccount(
                vault,
                accountPublicKeyHash,
                networkId,
                accounts,
                true,
                explicitAuthWalletAddress
              ),
            updateSettings: async settings => {
              const updatedSettings = await vault.updateSettings(settings);
              await createCustomNetworksSnapshot(updatedSettings);
              settingsUpdated(updatedSettings);
            },
            vault
          });
        })
      )
    );
  }

  const dAppReq = req as MavrykWalletDAppRequest;

  switch (dAppReq?.type) {
    case MavrykWalletDAppMessageType.GetCurrentPermissionRequest:
      return withInited(() => getCurrentPermission(origin));

    case MavrykWalletDAppMessageType.PermissionRequest:
      return withInited(() =>
        enqueueDAppForOrigin(origin, deadline => requestPermission(origin, dAppReq, deadline), isDAppEnabled, relayPort)
      );

    case MavrykWalletDAppMessageType.OperationRequest:
      return withInited(() =>
        enqueueDAppForOrigin(origin, deadline => requestOperation(origin, dAppReq, deadline), isDAppEnabled, relayPort)
      );

    case MavrykWalletDAppMessageType.SignRequest:
      return withInited(() =>
        enqueueDAppForOrigin(origin, deadline => requestSign(origin, dAppReq, deadline), isDAppEnabled, relayPort)
      );

    case MavrykWalletDAppMessageType.BroadcastRequest:
      return withInited(() => requestBroadcast(origin, dAppReq));
  }
}

async function createCustomNetworksSnapshot(settings: TempleSettings) {
  try {
    if (settings.customNetworks) {
      await browser.storage.local.set({
        custom_networks_snapshot: settings.customNetworks
      });
    }
  } catch {}
}

const close = (
  closing: boolean,
  port: Runtime.Port,
  id: string,
  stopTimeout: any,
  stopRequestListening: any,
  stopDisconnectListening: any
) => {
  let innerClosing = closing;
  if (innerClosing) return innerClosing;
  innerClosing = true;

  try {
    stopTimeout();
    stopRequestListening();
    stopDisconnectListening();

    intercom.notify(port, {
      type: TempleMessageType.ConfirmationExpired,
      id
    });
  } catch (_err) {}
  return innerClosing;
};
