import {
  MavrykWalletDAppMessageType,
  MavrykWalletDAppErrorType,
  MavrykWalletDAppRequest
} from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import { MavrykOperationError } from '@mavrykdynamics/webmavryk';
import { Runtime } from 'webextension-polyfill';

import { PUBLIC_EXTENSION_ID } from 'lib/extension-id';
import * as Beacon from 'lib/temple/beacon';
import { isBeaconPayloadWithinLimit } from 'lib/temple/beacon-payload';
import { buildMavrykSignedMessagePayloadHex } from 'mavryk/api/auth-payload.helpers';

import { processDApp } from './actions';
import { removeDApp } from './dapp';
import { DAPP_TOO_MANY_PENDING_REQUESTS_ERROR } from './dapp-queue';

const BEACON_ID = `temple_wallet_${PUBLIC_EXTENSION_ID}`;

export async function getBeaconMessage(origin: string, msg: string, encrypted = false) {
  if (!isBeaconPayloadWithinLimit(msg)) {
    throw new Error('Invalid Beacon message payload');
  }

  let recipientPubKey: string | null = null;
  let payload = null;

  if (encrypted) {
    try {
      recipientPubKey = await Beacon.getDAppPublicKey(origin);
      if (!recipientPubKey) throw new Error('<stub>');

      try {
        msg = await Beacon.decryptMessage(origin, msg, recipientPubKey);
      } catch (err: any) {
        await Beacon.removeDAppPublicKey(origin);
        throw err;
      }
    } catch {
      payload = {
        payload: Beacon.encodeMessage<Beacon.Response>({
          version: '2',
          senderId: await Beacon.getSenderId(origin),
          id: 'stub',
          type: Beacon.MessageType.Disconnect
        })
      };
    }
  }

  let req: Beacon.Request | null;
  try {
    req = Beacon.decodeMessage<Beacon.Request>(msg);
  } catch {
    req = null;
  }

  return {
    recipientPubKey,
    req,
    payload
  };
}

type ProcessedBeaconMessage = {
  payload: string;
  encrypted?: boolean;
};

export async function processBeacon(
  origin: string,
  msg: string,
  encrypted = false,
  relayPort?: Runtime.Port
): Promise<ProcessedBeaconMessage | undefined> {
  const { req, recipientPubKey, payload } = await getBeaconMessage(origin, msg, encrypted);
  if (payload) {
    return payload;
  }
  if (!req) {
    return;
  }

  // Process Disconnect
  if (req.type === Beacon.MessageType.Disconnect) {
    await removeDApp(origin);
    return;
  }

  const resBase = {
    version: req.version,
    id: req.id,
    ...(req.beaconId ? { beaconId: BEACON_ID } : { senderId: await Beacon.getSenderId(origin) })
  };

  // Process handshake
  if (req.type === Beacon.MessageType.HandshakeRequest) {
    await Beacon.saveDAppPublicKey(origin, req.publicKey);
    const keyPair = await Beacon.getOrCreateKeyPair(origin);
    return {
      payload: await Beacon.sealCryptobox(
        JSON.stringify({
          ...resBase,
          ...Beacon.PAIRING_RESPONSE_BASE,
          publicKey: Beacon.toHex(keyPair.publicKey)
        }),
        Beacon.fromHex(req.publicKey)
      )
    };
  }

  const res = await getBeaconResponse(req, resBase, origin, relayPort);
  // const res = null;

  const resMsg = Beacon.encodeMessage<Beacon.Response>(res);
  if (encrypted && recipientPubKey) {
    return {
      payload: await Beacon.encryptMessage(origin, resMsg, recipientPubKey),
      encrypted: true
    };
  }
  return { payload: resMsg };
}

const getBeaconResponse = async (
  req: Beacon.Request,
  resBase: any,
  origin: string,
  relayPort?: Runtime.Port
): Promise<Beacon.Response> => {
  try {
    try {
      return await formatTempleReq(getTempleReq(req), req, resBase, origin, relayPort);
    } catch (err: any) {
      if (err instanceof MavrykOperationError) {
        throw err;
      }

      console.log('err', err);

      // Map Temple DApp error to Beacon error
      const beaconErrorType = (() => {
        switch (err?.message) {
          case MavrykWalletDAppErrorType.InvalidParams:
            return Beacon.ErrorType.PARAMETERS_INVALID_ERROR;

          case MavrykWalletDAppErrorType.NotFound:
          case MavrykWalletDAppErrorType.NotGranted:
            return req.beaconId ? Beacon.ErrorType.NOT_GRANTED_ERROR : Beacon.ErrorType.ABORTED_ERROR;

          case DAPP_TOO_MANY_PENDING_REQUESTS_ERROR:
            return Beacon.ErrorType.UNKNOWN_ERROR;

          default:
            return err?.message;
        }
      })();

      throw new Error(beaconErrorType, { cause: err?.message });
    }
  } catch (err: any) {
    return {
      ...resBase,
      type: Beacon.MessageType.Error,
      errorType: (() => {
        switch (true) {
          case err instanceof MavrykOperationError:
            return Beacon.ErrorType.TRANSACTION_INVALID_ERROR;

          case err?.message in Beacon.ErrorType:
            return err.message;

          default:
            return Beacon.ErrorType.UNKNOWN_ERROR;
        }
      })(),
      errorData: getErrorData(err)
    };
  }
};

const getTempleReq = (req: Beacon.Request): MavrykWalletDAppRequest | void => {
  switch (req.type) {
    case Beacon.MessageType.PermissionRequest:
      const network =
        req.network.type === 'custom'
          ? {
              name: req.network.name!,
              rpc: req.network.rpcUrl!
            }
          : req.network.type;

      return {
        type: MavrykWalletDAppMessageType.PermissionRequest,
        network: network as any,
        appMeta: req.appMetadata,
        force: true
      };

    case Beacon.MessageType.OperationRequest:
      return {
        type: MavrykWalletDAppMessageType.OperationRequest,
        sourcePkh: req.sourceAddress,
        opParams: req.operationDetails.map(Beacon.formatOpParams)
      };

    case Beacon.MessageType.SignPayloadRequest:
      return {
        type: MavrykWalletDAppMessageType.SignRequest,
        sourcePkh: req.sourceAddress,
        payload: req.signingType === Beacon.SigningType.RAW ? generateRawPayloadBytes(req.payload) : req.payload
      };

    case Beacon.MessageType.BroadcastRequest:
      return {
        type: MavrykWalletDAppMessageType.BroadcastRequest,
        signedOpBytes: req.signedTransaction
      };
  }
};

const formatTempleReq = async (
  templeReq: MavrykWalletDAppRequest | void,
  req: Beacon.Request,
  resBase: any,
  origin: string,
  relayPort?: Runtime.Port
) => {
  if (templeReq) {
    const templeRes = await processDApp(origin, templeReq, relayPort);

    if (templeRes) {
      // Map Temple DApp response to Beacon response
      switch (templeRes.type) {
        case MavrykWalletDAppMessageType.PermissionResponse:
          return {
            ...resBase,
            type: Beacon.MessageType.PermissionResponse,
            publicKey: (templeRes as any).publicKey,
            network: (req as Beacon.PermissionRequest).network,
            scopes: [Beacon.PermissionScope.OPERATION_REQUEST, Beacon.PermissionScope.SIGN]
          };

        case MavrykWalletDAppMessageType.OperationResponse:
          return {
            ...resBase,
            type: Beacon.MessageType.OperationResponse,
            transactionHash: templeRes.opHash
          };

        case MavrykWalletDAppMessageType.SignResponse:
          return {
            ...resBase,
            type: Beacon.MessageType.SignPayloadResponse,
            signature: templeRes.signature
          };

        case MavrykWalletDAppMessageType.BroadcastResponse:
          return {
            ...resBase,
            type: Beacon.MessageType.BroadcastResponse,
            transactionHash: templeRes.opHash
          };
      }
    }
  }

  throw new Error(Beacon.ErrorType.UNKNOWN_ERROR);
};

function getErrorData(err: any) {
  if (err?.cause === DAPP_TOO_MANY_PENDING_REQUESTS_ERROR) {
    // Beacon has no "busy" error type, so expose the reason for dApps to retry on
    return DAPP_TOO_MANY_PENDING_REQUESTS_ERROR;
  }
  return err instanceof MavrykOperationError ? err.errors.map(({ contract_code, ...rest }: any) => rest) : undefined;
}

function generateRawPayloadBytes(payload: string) {
  return buildMavrykSignedMessagePayloadHex(payload);
}
