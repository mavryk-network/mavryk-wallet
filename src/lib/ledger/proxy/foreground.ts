import browser from 'webextension-polyfill';

import { createQueue, stringToUInt8Array } from 'lib/utils';

import { getLedgerTransportType } from '../helpers';
import type { TempleLedgerSigner } from '../signer';
import { TransportType } from '../types';

import type { CreatorArguments, ForegroundResponse, ProxyMessage, ReleaseMessage, RequestMessage } from './types';

let windowIsActive = document.hasFocus();

window.onfocus = () => {
  windowIsActive = true;
};

window.onblur = () => {
  windowIsActive = false;
};

browser.runtime.onMessage.addListener((message: unknown): Promise<ForegroundResponse | null> | void => {
  if (!isKnownMessage(message)) return;

  if (message.type === 'LEDGER_PROXY_RELEASE') {
    return releaseKeptLedgerSigner(message);
  }

  const transportType = getLedgerTransportType();

  if ([TransportType.WEBAUTHN, TransportType.U2F].includes(transportType)) {
    /* These transports require an active window only */
    if (windowIsActive) return buildSignerCallResponse(message, transportType);
    else return;
  }

  const pagesWindows = getPagesWindows();

  /* Only letting the first page to respond */
  if (pagesWindows[0]! !== window) return;

  return buildSignerCallResponse(message, transportType);
});

const isKnownMessage = (msg: any): msg is ProxyMessage =>
  typeof msg === 'object' && msg !== null && ['LEDGER_PROXY_REQUEST', 'LEDGER_PROXY_RELEASE'].includes(msg.type);

function getPagesWindows() {
  const windows = browser.extension.getViews();
  const bgWindow: Window | null = browser.extension.getBackgroundPage();
  if (bgWindow) {
    const index = windows.indexOf(bgWindow);
    if (index > -1) windows.splice(index, 1);
  }

  return windows;
}

const buildSignerCallResponse = async (
  message: RequestMessage,
  transportType: TransportType
): Promise<ForegroundResponse> => {
  try {
    const keptSigner = await createKeptLedgerSigner(message.instanceId, message.creatorArgs, transportType);

    return keptSigner.enqueue(async () => {
      try {
        const value = await callSignerMethod(keptSigner.signer, message);
        return { type: 'success', value };
      } catch (err: any) {
        return { type: 'error', message: err.message };
      }
    });
  } catch (error: any) {
    console.error(error);
    return { type: 'error', message: error?.message || 'Error, when creating a signer' };
  }
};

interface KeptSignerState {
  signer: TempleLedgerSigner;
  transportType: TransportType;
  creatorArgs: CreatorArguments;
  enqueue: ReturnType<typeof createQueue>;
}

/* Instance ids restart with every background worker, so a kept signer must also match the requested account */
const isSameLedgerSignerIdentity = (a: CreatorArguments, b: CreatorArguments) =>
  a.derivationPath === b.derivationPath &&
  a.derivationType === b.derivationType &&
  a.publicKey === b.publicKey &&
  a.publicKeyHash === b.publicKeyHash;

const canReuseKeptSigner = (state: KeptSignerState, creatorArgs: CreatorArguments, transportType: TransportType) =>
  state.transportType === transportType && isSameLedgerSignerIdentity(state.creatorArgs, creatorArgs);

const keptSigners = new Map<number, Promise<KeptSignerState> | KeptSignerState>();

const createKeptLedgerSigner = async (
  instanceId: number,
  creatorArgs: CreatorArguments,
  transportType: TransportType
) => {
  const cachedSigner = keptSigners.get(instanceId);
  let signerQueue: ReturnType<typeof createQueue> | undefined;

  if (
    cachedSigner &&
    !(cachedSigner instanceof Promise) &&
    canReuseKeptSigner(cachedSigner, creatorArgs, transportType)
  ) {
    return cachedSigner;
  }

  if (cachedSigner instanceof Promise) {
    const pendingState = await cachedSigner;
    signerQueue = pendingState.enqueue;

    if (canReuseKeptSigner(pendingState, creatorArgs, transportType)) {
      return pendingState;
    }
  } else {
    signerQueue = cachedSigner?.enqueue;
  }

  const pendingSigner = (async () => {
    const { derivationPath, derivationType, publicKey, publicKeyHash } = creatorArgs;
    const createLedgerSigner = (await import('../index')).createLedgerSigner;
    const { signer } = await createLedgerSigner(
      transportType,
      derivationPath,
      derivationType,
      publicKey,
      publicKeyHash
    );

    return {
      signer,
      transportType,
      creatorArgs,
      enqueue: signerQueue ?? createQueue()
    };
  })();

  keptSigners.set(instanceId, pendingSigner);

  try {
    const nextSigner = await pendingSigner;
    keptSigners.set(instanceId, nextSigner);

    return nextSigner;
  } catch (error) {
    keptSigners.delete(instanceId);
    throw error;
  }
};

const releaseKeptLedgerSigner = async ({ instanceId }: ReleaseMessage): Promise<null> => {
  keptSigners.delete(instanceId);

  return null;
};

const callSignerMethod = (signer: TempleLedgerSigner, message: RequestMessage) => {
  switch (message.method) {
    case 'publicKey':
      return signer.publicKey();
    case 'publicKeyHash':
      return signer.publicKeyHash();
    case 'sign':
      const magicByte = message.args.magicByte ? stringToUInt8Array(message.args.magicByte) : undefined;
      return signer.sign(message.args.op, magicByte);
  }
  throw new Error(`Unreachable code`);
};
