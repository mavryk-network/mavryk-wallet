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
import { localForger } from '@mavrykdynamics/webmavryk-local-forging';
import { valueDecoder } from '@mavrykdynamics/webmavryk-local-forging/dist/lib/michelson/codec';
import { Uint8ArrayConsumer } from '@mavrykdynamics/webmavryk-local-forging/dist/lib/uint8array-consumer';
import { emitMicheline } from '@mavrykdynamics/webmavryk-michel-codec';
import { RpcClient } from '@mavrykdynamics/webmavryk-rpc';
import { nanoid } from 'nanoid';
import browser, { Runtime } from 'webextension-polyfill';

import { addLocalOperation } from 'lib/temple/activity';
import * as Beacon from 'lib/temple/beacon';
import { loadChainId, isAddressValid } from 'lib/temple/helpers';
import { NETWORKS } from 'lib/temple/networks';
import {
  TempleMessageType,
  TempleRequest,
  TempleDAppPayload,
  TempleDAppSession,
  TempleDAppSessions,
  TempleNotification
} from 'lib/temple/types';

import { AUTODECLINE_AFTER } from './constants';
import { intercom } from './defaults';
import { buildFinalOpParmas, dryRunOpParams } from './dryrun';
import { withUnlocked } from './store';

const CONFIRM_WINDOW_WIDTH = 400;
let corruptionAlertSent = false;
const CONFIRM_WINDOW_HEIGHT = 604;
const STORAGE_KEY = 'dapp_sessions';
const HEX_PATTERN = /^[0-9a-fA-F]+$/;
const TEZ_MSG_SIGN_PATTERN = /^0501[a-f0-9]{8}54657a6f73205369676e6564204d6573736167653a20[a-f0-9]*$/;

// Security note: HMAC key is derived from passHash (SHA-256 of password), not a stretched key.
// Security is bounded by password entropy — acceptable for tamper detection against passive
// local storage readers. Not a substitute for full encryption.
let hmacKey: CryptoKey | null = null;

export async function setDAppHmacKey(passHash: ArrayBuffer) {
  hmacKey = await crypto.subtle.importKey('raw', passHash, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify'
  ]);
}

export function clearDAppHmacKey() {
  hmacKey = null;
}

export async function getCurrentPermission(origin: string): Promise<MavrykWalletDAppGetCurrentPermissionResponse> {
  const dApp = await getDApp(origin);
  const permission = dApp
    ? {
        rpc: await getNetworkRPC(dApp.network),
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
  req: MavrykWalletDAppPermissionRequest
): Promise<MavrykWalletDAppPermissionResponse> {
  if (![isAllowedNetwork(req?.network), typeof req?.appMeta?.name === 'string'].every(Boolean)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const networkRpc = await getNetworkRPC(req.network);
  const dApp = await getDApp(origin);

  if (!req.force && dApp && isNetworkEquals(req.network, dApp.network) && req.appMeta.name === dApp.appMeta.name) {
    return {
      type: MavrykWalletDAppMessageType.PermissionResponse,
      rpc: networkRpc,
      pkh: dApp.pkh,
      publicKey: dApp.publicKey
    };
  }

  return new Promise(async (resolve, reject) => {
    const id = nanoid();

    await requestConfirm({
      id,
      payload: {
        type: 'connect',
        origin,
        networkRpc,
        appMeta: req.appMeta
      },
      onDecline: () => {
        reject(new Error(MavrykWalletDAppErrorType.NotGranted));
      },
      handleIntercomRequest: async (confirmReq, decline) => {
        if (confirmReq?.type === TempleMessageType.DAppPermConfirmationRequest && confirmReq?.id === id) {
          const { confirmed, accountPublicKeyHash, accountPublicKey } = confirmReq;
          if (confirmed && accountPublicKeyHash && accountPublicKey) {
            await setDApp(origin, {
              network: req.network,
              appMeta: req.appMeta,
              pkh: accountPublicKeyHash,
              publicKey: accountPublicKey
            });
            resolve({
              type: MavrykWalletDAppMessageType.PermissionResponse,
              pkh: accountPublicKeyHash,
              publicKey: accountPublicKey,
              rpc: networkRpc
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
  req: MavrykWalletDAppOperationRequest
): Promise<MavrykWalletDAppOperationResponse> {
  if (
    ![
      isAddressValid(req?.sourcePkh),
      req?.opParams?.length > 0,
      req?.opParams?.every(op => typeof op.kind === 'string')
    ].every(Boolean)
  ) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const dApp = await getDApp(origin);

  if (!dApp) {
    throw new Error(MavrykWalletDAppErrorType.NotGranted);
  }

  if (req.sourcePkh !== dApp.pkh) {
    throw new Error(MavrykWalletDAppErrorType.NotFound);
  }

  return new Promise(async (resolve, reject) => {
    const id = nanoid();
    const networkRpc = await getNetworkRPC(dApp.network);

    await requestConfirm({
      id,
      payload: {
        type: 'confirm_operations',
        origin,
        networkRpc,
        appMeta: dApp.appMeta,
        sourcePkh: req.sourcePkh,
        sourcePublicKey: dApp.publicKey,
        opParams: req.opParams
      },
      onDecline: () => {
        reject(new Error(MavrykWalletDAppErrorType.NotGranted));
      },
      handleIntercomRequest: (confirmReq, decline) =>
        handleIntercomRequest(confirmReq, decline, id, dApp, networkRpc, req, resolve, reject)
    });
  });
}

const handleIntercomRequest = async (
  confirmReq: TempleRequest,
  decline: () => void,
  id: string,
  dApp: TempleDAppSession,
  networkRpc: string,
  req: MavrykWalletDAppOperationRequest,
  resolve: any,
  reject: any
) => {
  if (confirmReq?.type === TempleMessageType.DAppOpsConfirmationRequest && confirmReq?.id === id) {
    if (confirmReq.confirmed) {
      try {
        const op = await withUnlocked(({ vault }) =>
          vault.sendOperations(
            dApp.pkh,
            networkRpc,
            buildFinalOpParmas(req.opParams, confirmReq.modifiedTotalFee, confirmReq.modifiedStorageLimit)
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
  req: MavrykWalletDAppSignRequest
): Promise<MavrykWalletDAppSignResponse> {
  if (req?.payload?.startsWith('0x')) {
    req = { ...req, payload: req.payload.substring(2) };
  }

  if (![isAddressValid(req?.sourcePkh), HEX_PATTERN.test(req?.payload)].every(Boolean)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const dApp = await getDApp(origin);

  if (!dApp) {
    throw new Error(MavrykWalletDAppErrorType.NotGranted);
  }

  if (req.sourcePkh !== dApp.pkh) {
    throw new Error(MavrykWalletDAppErrorType.NotFound);
  }

  return new Promise((resolve, reject) => generatePromisifySign(resolve, reject, dApp, req));
}

const generatePromisifySign = async (
  resolve: any,
  reject: any,
  dApp: TempleDAppSession,
  req: MavrykWalletDAppSignRequest
) => {
  const id = nanoid();
  const networkRpc = await getNetworkRPC(dApp.network);

  let preview: any;
  try {
    const value = valueDecoder(Uint8ArrayConsumer.fromHexString(req.payload.slice(2)));
    const parsed = emitMicheline(value, {
      indent: '  ',
      newline: '\n'
    }).slice(1, -1);

    if (req.payload.match(TEZ_MSG_SIGN_PATTERN)) {
      preview = value.string;
    } else {
      if (parsed.length > 0) {
        preview = parsed;
      } else {
        const parsed = await localForger.parse(req.payload);
        if (parsed.contents.length > 0) {
          preview = parsed;
        }
      }
    }
  } catch {
    preview = null;
  }

  await requestConfirm({
    id,
    payload: {
      type: 'sign',
      origin,
      networkRpc,
      appMeta: dApp.appMeta,
      sourcePkh: req.sourcePkh,
      payload: req.payload,
      preview
    },
    onDecline: () => {
      reject(new Error(MavrykWalletDAppErrorType.NotGranted));
    },
    handleIntercomRequest: async (confirmReq, decline) => {
      if (confirmReq?.type === TempleMessageType.DAppSignConfirmationRequest && confirmReq?.id === id) {
        if (confirmReq.confirmed) {
          const { prefixSig: signature } = await withUnlocked(({ vault }) => vault.sign(dApp.pkh, req.payload));
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

  try {
    const rpc = new RpcClient(await getNetworkRPC(dApp.network));
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

export async function getAllDApps(): Promise<TempleDAppSessions> {
  const stored = (await browser.storage.local.get([STORAGE_KEY]))[STORAGE_KEY];
  if (!stored) return {};

  if (stored.data && stored.hmac && hmacKey) {
    const sigBytes = new Uint8Array((stored.hmac as string).match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
    const valid = await crypto.subtle.verify('HMAC', hmacKey, sigBytes, new TextEncoder().encode(stored.data));
    if (!valid) {
      console.error('dApp session integrity check failed');
      await browser.storage.local.remove(STORAGE_KEY);
      if (!corruptionAlertSent) {
        corruptionAlertSent = true;
        intercom.broadcast({ type: TempleMessageType.DAppSessionsCorrupted });
      }
      return {};
    }
    return JSON.parse(stored.data);
  }

  // Legacy plain-object path
  if (typeof stored === 'object' && !stored.data) {
    // After migration has run, a plain-object here means tampered storage — reject
    const migrationResult = await browser.storage.local.get('dapp_sessions_migrated_v2');
    if (migrationResult['dapp_sessions_migrated_v2']) {
      console.error('dApp session data appears tampered — rejecting and clearing');
      await browser.storage.local.remove(STORAGE_KEY);
      return {};
    }
    // Pre-migration: validate and accept (migration will re-sign on next unlock)
    return validateDAppSessions(stored) ? (stored as TempleDAppSessions) : {};
  }

  return {};
}

async function getDApp(origin: string): Promise<TempleDAppSession | undefined> {
  return (await getAllDApps())[origin];
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

async function setDApps(newDApps: TempleDAppSessions) {
  // NOTE: hmacKey is derived from SHA-256(passHash) — key derivation strength is a separate deferred concern.
  if (!hmacKey) {
    throw new Error('Cannot write dApp session: HMAC key unavailable — wallet is locked');
  }
  const data = JSON.stringify(newDApps);
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(data));
  const hmac = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  await browser.storage.local.set({ [STORAGE_KEY]: { data, hmac } });
}

function validateDAppSessions(obj: unknown): obj is TempleDAppSessions {
  if (typeof obj !== 'object' || obj === null) return false;
  return Object.values(obj as Record<string, unknown>).every(
    v => typeof v === 'object' && v !== null && 'pkh' in v && 'network' in v && 'appMeta' in v
  );
}

type RequestConfirmParams = {
  id: string;
  payload: TempleDAppPayload;
  onDecline: () => void;
  handleIntercomRequest: (req: TempleRequest, decline: () => void) => Promise<any>;
};

async function requestConfirm({ id, payload, onDecline, handleIntercomRequest }: RequestConfirmParams) {
  // Defensive: declare closeWindow before registering the listener so the handler
  // always has a defined reference. The real implementation is assigned after
  // createConfirmationWindow resolves. (Note: the temporal dead zone race this
  // guards against does not exist in practice due to JS closure semantics, but
  // this makes the intent explicit.)
  let closeWindow: () => Promise<void> = async () => {};

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

  const declineAndClose = () => {
    onDecline();
    close();
  };

  // One-time token: binds the confirm window that opened with this id to the port
  // that first sends a matching DAppGetPayloadRequest. Prevents a second window
  // (double-click, malicious iframe) from hijacking knownPort before the legitimate
  // window registers.
  let confirmToken: string | null = crypto.randomUUID();

  let knownPort: Runtime.Port | undefined;
  const stopRequestListening = intercom.onRequest(async (req: TempleRequest, port) => {
    if (req?.type === TempleMessageType.DAppGetPayloadRequest && req.id === id) {
      // Token must be present, match, and not already consumed.
      if (!confirmToken || req.token !== confirmToken) return;
      // Consume the token — cannot be reused by a second window.
      confirmToken = null;

      knownPort = port;

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

      const result = await handleIntercomRequest(req, onDecline);
      if (result) {
        close();
        return result;
      }
    }
  });

  const confirmWin = await createConfirmationWindow(id, confirmToken!);

  closeWindow = async () => {
    if (confirmWin.id) {
      const win = await browser.windows.get(confirmWin.id);
      if (win.id) {
        await browser.windows.remove(win.id);
      }
    }
  };

  const handleWinRemoved = (winId: number) => {
    if (winId === confirmWin?.id) {
      declineAndClose();
    }
  };
  browser.windows.onRemoved.addListener(handleWinRemoved);
  const stopWinRemovedListening = () => browser.windows.onRemoved.removeListener(handleWinRemoved);

  // Decline after timeout
  const t = setTimeout(declineAndClose, AUTODECLINE_AFTER);
  const stopTimeout = () => clearTimeout(t);
}

async function getNetworkRPC(net: MavrykWalletDAppNetwork) {
  const targetRpc = typeof net === 'string' ? NETWORKS.find(n => n.id === net)!.rpcBaseURL : removeLastSlash(net.rpc);

  if (typeof net === 'string') {
    try {
      const current = await getCurrentTempleNetwork();
      const [currentChainId, targetChainId] = await Promise.all([
        loadChainId(current.rpcBaseURL),
        loadChainId(targetRpc).catch(() => null)
      ]);

      return targetChainId === null || currentChainId === targetChainId ? current.rpcBaseURL : targetRpc;
    } catch {
      return targetRpc;
    }
  } else {
    return targetRpc;
  }
}

async function getCurrentTempleNetwork() {
  const { network_id: networkId, custom_networks_snapshot: customNetworksSnapshot } = await browser.storage.local.get([
    'network_id',
    'custom_networks_snapshot'
  ]);

  return [...NETWORKS, ...(customNetworksSnapshot ?? [])].find(n => n.id === networkId) ?? NETWORKS[0];
}

function isAllowedNetwork(net: MavrykWalletDAppNetwork) {
  return typeof net === 'string' ? NETWORKS.some(n => !n.disabled && n.id === net) : Boolean(net?.rpc);
}

function isNetworkEquals(fNet: MavrykWalletDAppNetwork, sNet: MavrykWalletDAppNetwork) {
  return typeof fNet !== 'string' && typeof sNet !== 'string'
    ? removeLastSlash(fNet.rpc) === removeLastSlash(sNet.rpc)
    : fNet === sNet;
}

function removeLastSlash(str: string) {
  return str.endsWith('/') ? str.slice(0, -1) : str;
}

async function createConfirmationWindow(confirmationId: string, token: string) {
  const isWin = (await browser.runtime.getPlatformInfo()).os === 'win';

  const height = isWin ? CONFIRM_WINDOW_HEIGHT + 17 : CONFIRM_WINDOW_HEIGHT;
  const width = isWin ? CONFIRM_WINDOW_WIDTH + 16 : CONFIRM_WINDOW_WIDTH;

  const [top, left] = (await getCenterPositionForWindow(width, height)) || [];

  const options: browser.Windows.CreateCreateDataType = {
    type: 'popup',
    url: browser.runtime.getURL(`confirm.html#?id=${confirmationId}&token=${token}`),
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
