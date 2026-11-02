import {
  MavrykWalletDAppMessageType,
  MavrykWalletDAppErrorType,
  MavrykWalletDAppGetCurrentPermissionResponse,
  MavrykWalletDAppPermissionRequest,
  MavrykWalletDAppPermissionResponse,
  MavrykWalletDAppOperationRequest,
  MavrykWalletDAppOperationResponse,
  MavrykWalletDAppSignRequest,
  MavrykWalletDAppSignResponse,
  MavrykWalletDAppBroadcastRequest,
  MavrykWalletDAppBroadcastResponse,
  MavrykWalletDAppNetwork
} from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import { MavrykOperationError } from '@mavrykdynamics/webmavryk';
import { RpcClient } from '@mavrykdynamics/webmavryk-rpc';
import { nanoid } from 'nanoid';
import browser, { Runtime } from 'webextension-polyfill';

import { addLocalOperation } from 'lib/temple/activity';
import * as Beacon from 'lib/temple/beacon';
import { loadChainId, isAddressValid } from 'lib/temple/helpers';
import { normalizeNetworkId } from 'lib/temple/network-storage';
import { NETWORKS } from 'lib/temple/networks';
import {
  TempleMessageType,
  TempleRequest,
  TempleDAppPayload,
  TempleDAppSession,
  TempleDAppSessions,
  TempleNotification
} from 'lib/temple/types';

import { DAPP_CONFIRMATION_AUTODECLINE_MS } from './constants';
import {
  assertBranchNotOnBuiltInChain,
  assertSessionChainId,
  getDAppVisibleRpc,
  getNetworkRPC,
  getSignRequestRpc,
  isAllowedCustomRpcUrl,
  removeLastSlash,
  resolveNetwork,
  type ResolvedNetwork
} from './dapp-network';
import { createDecisionGate } from './decision-gate';
import { intercom } from './defaults';
import { buildFinalOpParmas, dryRunOpParams, validateOpParams } from './dryrun';
import { assertConfirmUiPortInfo } from './intercom-permissions';
import { prepareDAppSignPayload, type PreparedDAppSignPayload } from './sign-payload.helpers';
import { withUnlocked } from './store';

const CONFIRM_WINDOW_WIDTH = 400;
const CONFIRM_WINDOW_HEIGHT = 604;
const STORAGE_KEY = 'dapp_sessions';

export const consumeConfirmToken = (expectedToken: string | null, receivedToken?: string) => {
  const isValid = expectedToken !== null && receivedToken === expectedToken;

  return {
    isValid,
    nextToken: isValid ? null : expectedToken
  };
};

export async function getCurrentPermission(origin: string): Promise<MavrykWalletDAppGetCurrentPermissionResponse> {
  const dApp = await getDApp(origin);
  const permission = dApp
    ? {
        rpc: await getDAppVisibleRpc(dApp.network),
        pkh: dApp.pkh,
        publicKey: dApp.publicKey
      }
    : null;
  return {
    type: MavrykWalletDAppMessageType.GetCurrentPermissionResponse,
    permission
  };
}

export async function requestPermission(
  origin: string,
  req: MavrykWalletDAppPermissionRequest,
  promptDeadline?: number
): Promise<MavrykWalletDAppPermissionResponse> {
  if (![isAllowedNetwork(req?.network), typeof req?.appMeta?.name === 'string'].every(Boolean)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const dAppRpc = await getDAppVisibleRpc(req.network);
  const dApp = await getDApp(origin);

  if (!req.force && dApp && isNetworkEquals(req.network, dApp.network) && req.appMeta.name === dApp.appMeta.name) {
    return {
      type: MavrykWalletDAppMessageType.PermissionResponse,
      rpc: dAppRpc,
      pkh: dApp.pkh,
      publicKey: dApp.publicKey
    };
  }

  return new Promise(async (resolve, reject) => {
    const id = nanoid();
    // Resolved only once the prompt is on screen, so a page cannot make the wallet probe an RPC of its choice silently.
    let network: ResolvedNetwork | undefined;

    await requestConfirm({
      id,
      promptDeadline,
      payload: {
        type: 'connect',
        origin,
        networkRpc: dAppRpc,
        appMeta: req.appMeta
      },
      preparePayload: async payload => {
        try {
          network = await resolveNetwork(req.network);
        } catch (err) {
          reject(new Error(MavrykWalletDAppErrorType.InvalidParams));
          throw err;
        }

        return { ...payload, networkRpc: network.rpc, chainId: network.chainId };
      },
      onDecline: () => {
        reject(new Error(MavrykWalletDAppErrorType.NotGranted));
      },
      handleIntercomRequest: async (confirmReq, decline) => {
        if (confirmReq?.type === TempleMessageType.DAppPermConfirmationRequest && confirmReq?.id === id) {
          const { confirmed, accountPublicKeyHash, accountPublicKey } = confirmReq;
          if (confirmed && accountPublicKeyHash && accountPublicKey && network) {
            await setDApp(origin, {
              network: req.network,
              ...(network.chainId ? { chainId: network.chainId } : {}),
              appMeta: req.appMeta,
              pkh: accountPublicKeyHash,
              publicKey: accountPublicKey
            });
            resolve({
              type: MavrykWalletDAppMessageType.PermissionResponse,
              pkh: accountPublicKeyHash,
              publicKey: accountPublicKey,
              rpc: dAppRpc
            });
            const broadcastMsg: TempleNotification = {
              type: TempleMessageType.SelectedAccountChanged,
              accountPublicKeyHash
            };
            intercom.broadcast(broadcastMsg);
          } else {
            decline();
          }

          return {
            type: TempleMessageType.DAppPermConfirmationResponse
          };
        }
        return undefined;
      }
    });
  });
}

export async function requestOperation(
  origin: string,
  req: MavrykWalletDAppOperationRequest,
  promptDeadline?: number
): Promise<MavrykWalletDAppOperationResponse> {
  if (!isAddressValid(req?.sourcePkh)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  try {
    validateOpParams(req?.opParams);
  } catch {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  if (req.opParams.some(op => typeof op?.source === 'string' && op.source !== req.sourcePkh)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const dApp = await getDApp(origin);

  if (!dApp) {
    throw new Error(MavrykWalletDAppErrorType.NotGranted);
  }

  if (req.sourcePkh !== dApp.pkh) {
    throw new Error(MavrykWalletDAppErrorType.NotFound);
  }

  // Resolved before the Promise executor so a failure rejects the request instead of leaving it pending.
  const { rpc: networkRpc, isDAppRpc } = await resolveNetwork(dApp.network);
  await assertSessionChainId(dApp, networkRpc);

  return new Promise(async (resolve, reject) => {
    const id = nanoid();

    await requestConfirm({
      id,
      promptDeadline,
      payload: {
        type: 'confirm_operations',
        origin,
        networkRpc,
        ...(dApp.chainId ? { chainId: dApp.chainId } : {}),
        appMeta: dApp.appMeta,
        sourcePkh: req.sourcePkh,
        sourcePublicKey: dApp.publicKey,
        opParams: req.opParams
      },
      onDecline: () => {
        reject(new Error(MavrykWalletDAppErrorType.NotGranted));
      },
      handleIntercomRequest: (confirmReq, decline, isDeclineDeferred) => {
        const beforeSign = isDAppRpc
          ? withVerifyingNotice(id, assertBranchNotOnBuiltInChain, isDeclineDeferred)
          : undefined;

        return handleIntercomRequest(confirmReq, decline, id, dApp, networkRpc, req, resolve, reject, beforeSign);
      }
    });
  });
}

/**
 * Tells the confirm window while the operation is verified before signing, which can take about one block. Closing
 * the window or the auto-decline deadline during that time is only deferred, so it is honoured here, before signing.
 */
const withVerifyingNotice =
  (id: string, verify: (opBytes: string) => Promise<void>, isDeclineDeferred: () => boolean) =>
  async (opBytes: string): Promise<void> => {
    intercom.broadcast({ type: TempleMessageType.DAppOpsVerifying, id, verifying: true });
    try {
      await verify(opBytes);
    } finally {
      intercom.broadcast({ type: TempleMessageType.DAppOpsVerifying, id, verifying: false });
    }

    if (isDeclineDeferred()) {
      throw new Error(MavrykWalletDAppErrorType.NotGranted);
    }
  };

const handleIntercomRequest = async (
  confirmReq: TempleRequest,
  decline: () => void,
  id: string,
  dApp: TempleDAppSession,
  networkRpc: string,
  req: MavrykWalletDAppOperationRequest,
  resolve: any,
  reject: any,
  beforeSign?: (opBytes: string) => Promise<void>
) => {
  if (confirmReq?.type === TempleMessageType.DAppOpsConfirmationRequest && confirmReq?.id === id) {
    if (confirmReq.confirmed) {
      try {
        const op = await withUnlocked(({ vault }) =>
          vault.sendOperations(
            dApp.pkh,
            networkRpc,
            buildFinalOpParmas(req.opParams, confirmReq.modifiedTotalFee, confirmReq.modifiedStorageLimit),
            beforeSign
          )
        );

        safeGetChain(networkRpc, op);

        resolve({
          type: MavrykWalletDAppMessageType.OperationResponse,
          opHash: op.hash
        });
      } catch (err: any) {
        if (err instanceof MavrykOperationError) {
          err.message = MavrykWalletDAppErrorType.TezosOperation;
          reject(err);
        } else {
          throw err;
        }
      }
    } else {
      decline();
    }

    return {
      type: TempleMessageType.DAppOpsConfirmationResponse
    };
  }
  return undefined;
};

const safeGetChain = async (networkRpc: string, op: any) => {
  try {
    const chainId = await loadChainId(networkRpc);
    await addLocalOperation(chainId, op.hash, op.results);
  } catch {}
};

export async function requestSign(
  origin: string,
  req: MavrykWalletDAppSignRequest,
  promptDeadline?: number
): Promise<MavrykWalletDAppSignResponse> {
  if (![isAddressValid(req?.sourcePkh), typeof req?.payload === 'string'].every(Boolean)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  let preparedPayload: PreparedDAppSignPayload;
  try {
    preparedPayload = prepareDAppSignPayload(req.payload, origin);
  } catch {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const signReq = { ...req, payload: preparedPayload.payload };
  const dApp = await getDApp(origin);

  if (!dApp) {
    throw new Error(MavrykWalletDAppErrorType.NotGranted);
  }

  if (signReq.sourcePkh !== dApp.pkh) {
    throw new Error(MavrykWalletDAppErrorType.NotFound);
  }

  const networkRpc = await getSignRequestRpc(dApp);

  return new Promise((resolve, reject) =>
    generatePromisifySign(resolve, reject, origin, dApp, networkRpc, signReq, preparedPayload, promptDeadline)
  );
}

const generatePromisifySign = async (
  resolve: any,
  reject: any,
  origin: string,
  dApp: TempleDAppSession,
  networkRpc: string,
  req: MavrykWalletDAppSignRequest,
  preparedPayload: PreparedDAppSignPayload,
  promptDeadline?: number
) => {
  const id = nanoid();

  await requestConfirm({
    id,
    promptDeadline,
    payload: {
      type: 'sign',
      origin,
      networkRpc,
      appMeta: dApp.appMeta,
      sourcePkh: req.sourcePkh,
      payload: req.payload,
      preview: preparedPayload.preview
    },
    onDecline: () => {
      reject(new Error(MavrykWalletDAppErrorType.NotGranted));
    },
    handleIntercomRequest: async (confirmReq, decline) => {
      if (confirmReq?.type === TempleMessageType.DAppSignConfirmationRequest && confirmReq?.id === id) {
        if (confirmReq.confirmed) {
          const { prefixSig: signature } = await withUnlocked(({ vault }) =>
            vault.sign(dApp.pkh, preparedPayload.bytesToSign, preparedPayload.watermark)
          );
          resolve({
            type: MavrykWalletDAppMessageType.SignResponse,
            signature
          });
        } else {
          decline();
        }

        return {
          type: TempleMessageType.DAppSignConfirmationResponse
        };
      }
      return undefined;
    }
  });
};

export async function requestBroadcast(
  origin: string,
  req: MavrykWalletDAppBroadcastRequest
): Promise<MavrykWalletDAppBroadcastResponse> {
  if (![req?.signedOpBytes?.length > 0].every(Boolean)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const dApp = await getDApp(origin);

  if (!dApp) {
    throw new Error(MavrykWalletDAppErrorType.NotGranted);
  }

  const networkRpc = await getNetworkRPC(dApp.network);
  await assertSessionChainId(dApp, networkRpc);

  try {
    const rpc = new RpcClient(networkRpc);
    const opHash = await rpc.injectOperation(req.signedOpBytes);
    return {
      type: MavrykWalletDAppMessageType.BroadcastResponse,
      opHash
    };
  } catch (err: any) {
    throw err instanceof MavrykOperationError
      ? (() => {
          err.message = MavrykWalletDAppErrorType.TezosOperation;
          return err;
        })()
      : new Error('Failed to broadcast');
  }
}

export async function getAllDApps() {
  const dAppsSessions: TempleDAppSessions = (await browser.storage.local.get([STORAGE_KEY]))[STORAGE_KEY] || {};
  return dAppsSessions;
}

/** A custom-RPC session stored before chain binding has no chainId: it is treated as absent so the dApp reconnects. */
async function getDApp(origin: string): Promise<TempleDAppSession | undefined> {
  const dApp = (await getAllDApps())[origin];

  return dApp && (typeof dApp.network === 'string' || dApp.chainId) ? dApp : undefined;
}

async function setDApp(origin: string, permissions: TempleDAppSession) {
  const current = await getAllDApps();
  const newDApps = { ...current, [origin]: permissions };
  await setDApps(newDApps);
  return newDApps;
}

export async function removeDApp(origin: string) {
  const { [origin]: permissionsToRemove, ...restDApps } = await getAllDApps();
  await setDApps(restDApps);
  await Beacon.removeDAppPublicKey(origin);
  return restDApps;
}

export async function removeAllDApps(origins: string[]) {
  await setDApps({});

  const promises = origins.map(async origin => {
    return await Beacon.removeDAppPublicKey(origin);
  });

  await Promise.all(promises);

  return {} as {
    [x: string]: TempleDAppSession;
  };
}

export async function removeDAppSessionsForPkhs(pkhs: string[]) {
  const removedPkhs = new Set(pkhs);
  const sessions = Object.entries(await getAllDApps());
  const removedOrigins = sessions.filter(([, session]) => removedPkhs.has(session.pkh)).map(([origin]) => origin);

  if (removedOrigins.length === 0) {
    return;
  }

  await setDApps(Object.fromEntries(sessions.filter(([, session]) => !removedPkhs.has(session.pkh))));
  await Promise.all(removedOrigins.map(origin => Beacon.removeDAppPublicKey(origin)));
}

function setDApps(newDApps: TempleDAppSessions) {
  return browser.storage.local.set({ [STORAGE_KEY]: newDApps });
}

const DAPP_DECISION_REQUEST_TYPES = new Set<TempleMessageType>([
  TempleMessageType.DAppPermConfirmationRequest,
  TempleMessageType.DAppOpsConfirmationRequest,
  TempleMessageType.DAppSignConfirmationRequest
]);

const isDAppDecisionRequest = (req: TempleRequest, id: string) =>
  DAPP_DECISION_REQUEST_TYPES.has(req?.type) && 'id' in req && req.id === id;

// An operation may only be approved when the preview was built from the locally forged operation (rawToSign).
const assertOperationPreviewVerified = (req: TempleRequest, payload: TempleDAppPayload) => {
  if (
    req?.type === TempleMessageType.DAppOpsConfirmationRequest &&
    req.confirmed &&
    payload.type === 'confirm_operations' &&
    !payload.rawToSign
  ) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }
};

type RequestConfirmParams = {
  id: string;
  /** Past this time the page may have given up on the request, so the prompt is declined instead of opened. */
  promptDeadline?: number;
  payload: TempleDAppPayload;
  /** Runs when the confirm UI first reads the payload; a failure declines and closes the prompt. */
  preparePayload?: (payload: TempleDAppPayload) => Promise<TempleDAppPayload>;
  onDecline: () => void;
  handleIntercomRequest: (req: TempleRequest, decline: () => void, isDeclineDeferred: () => boolean) => Promise<any>;
};

async function requestConfirm({
  id,
  promptDeadline,
  payload,
  preparePayload,
  onDecline,
  handleIntercomRequest
}: RequestConfirmParams) {
  if (promptDeadline !== undefined && Date.now() > promptDeadline) {
    onDecline();
    return;
  }

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;

    try {
      stopTimeout();
      stopRequestListening();
      stopWinRemovedListening();

      await closeWindow();
    } catch (_err) {}
  };

  const gate = createDecisionGate(() => {
    onDecline();
    close();
  });

  const initialConfirmToken = nanoid();
  let confirmToken: string | null = initialConfirmToken;
  let knownPort: Runtime.Port | undefined;
  const stopRequestListening = intercom.onRequest(async (req: TempleRequest, port, portInfo) => {
    if (req?.type === TempleMessageType.DAppGetPayloadRequest && req.id === id) {
      assertConfirmUiPortInfo(portInfo);

      const tokenResult = consumeConfirmToken(confirmToken, req.token);
      if (!tokenResult.isValid) {
        throw new Error('Unauthorized dApp confirmation token');
      }
      confirmToken = tokenResult.nextToken;
      knownPort = port;

      if (preparePayload) {
        try {
          payload = await preparePayload(payload);
        } catch (err) {
          gate.declineOrDefer();
          throw err;
        }
      }

      if (payload.type === 'confirm_operations') {
        const dryrunResult = await dryRunOpParams({
          opParams: payload.opParams,
          networkRpc: payload.networkRpc,
          sourcePkh: payload.sourcePkh,
          sourcePublicKey: payload.sourcePublicKey
        });
        if (dryrunResult) {
          payload = {
            ...payload,
            ...((dryrunResult && dryrunResult.result) ?? {}),
            ...(dryrunResult.error ? { error: dryrunResult } : {})
          };
        }
      }

      return {
        type: TempleMessageType.DAppGetPayloadResponse,
        payload
      };
    } else {
      if (knownPort !== port) return;
      assertConfirmUiPortInfo(portInfo);

      const isDecision = isDAppDecisionRequest(req, id);
      if (isDecision) gate.begin();

      let handled = false;
      try {
        if (isDecision) assertOperationPreviewVerified(req, payload);

        const result = await handleIntercomRequest(req, onDecline, gate.isDeclineDeferred);
        if (result) {
          handled = true;
          close();
          return result;
        }
      } finally {
        // A decision the handler did not take (wrong type, or it threw) must not keep auto-decline suspended.
        if (isDecision && !handled) gate.release();
      }
    }
  });

  const confirmWin = await createConfirmationWindow(id, initialConfirmToken);

  const closeWindow = async () => {
    if (confirmWin.id) {
      const win = await browser.windows.get(confirmWin.id);
      if (win.id) {
        await browser.windows.remove(win.id);
      }
    }
  };

  const handleWinRemoved = (winId: number) => {
    if (winId === confirmWin?.id) {
      gate.declineOrDefer();
    }
  };
  browser.windows.onRemoved.addListener(handleWinRemoved);
  const stopWinRemovedListening = () => browser.windows.onRemoved.removeListener(handleWinRemoved);

  // Decline after timeout
  const t = setTimeout(gate.declineOrDefer, DAPP_CONFIRMATION_AUTODECLINE_MS);
  const stopTimeout = () => clearTimeout(t);
}

function isAllowedNetwork(net: MavrykWalletDAppNetwork) {
  return typeof net === 'string'
    ? NETWORKS.some(n => !n.disabled && n.id === normalizeNetworkId(net))
    : typeof net?.rpc === 'string' && isAllowedCustomRpcUrl(net.rpc);
}

function isNetworkEquals(fNet: MavrykWalletDAppNetwork, sNet: MavrykWalletDAppNetwork) {
  if (typeof fNet === 'string' && typeof sNet === 'string') {
    return normalizeNetworkId(fNet) === normalizeNetworkId(sNet);
  }

  return typeof fNet !== 'string' && typeof sNet !== 'string'
    ? removeLastSlash(fNet.rpc) === removeLastSlash(sNet.rpc)
    : false;
}

async function createConfirmationWindow(confirmationId: string, token: string) {
  const isWin = (await browser.runtime.getPlatformInfo()).os === 'win';

  const height = isWin ? CONFIRM_WINDOW_HEIGHT + 17 : CONFIRM_WINDOW_HEIGHT;
  const width = isWin ? CONFIRM_WINDOW_WIDTH + 16 : CONFIRM_WINDOW_WIDTH;

  const [top, left] = (await getCenterPositionForWindow(width, height)) || [];

  const options: browser.Windows.CreateCreateDataType = {
    type: 'popup',
    url: browser.runtime.getURL(
      `confirm.html#?id=${encodeURIComponent(confirmationId)}&token=${encodeURIComponent(token)}`
    ),
    width,
    height
  };

  try {
    /* Trying, because must have 50% of window in a viewport. Otherwise, error thrown. */
    const confirmWin = await browser.windows.create({ ...options, top, left });

    // Firefox currently ignores left/top for create, but it works for update
    if (left != null && confirmWin.id && confirmWin.state !== 'fullscreen' && confirmWin.left !== left)
      await browser.windows.update(confirmWin.id, { left, top }).catch(() => void 0);

    return confirmWin;
  } catch {
    return await browser.windows.create(options);
  }
}

/** Position window in the center of lastFocused window */
async function getCenterPositionForWindow(width: number, height: number): Promise<[number, number] | undefined> {
  const lastFocused = await browser.windows.getLastFocused().catch(() => void 0);

  if (lastFocused == null || lastFocused.width == null) return;

  const top = Math.round(lastFocused.top! + lastFocused.height! / 2 - height / 2);
  const left = Math.round(lastFocused.left! + lastFocused.width! / 2 - width / 2);

  return [top, left];
}
