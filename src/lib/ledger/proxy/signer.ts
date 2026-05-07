import type { Signer } from '@mavrykdynamics/webmavryk';
import browser from 'webextension-polyfill';

import { PublicError } from 'lib/temple/back/PublicError';
import { createQueue, uInt8ArrayToString } from 'lib/utils';

import { TransportType } from '../types';

import type {
  ProxiedMethodName,
  MethodsSerialArgs,
  MethodsReturns,
  CreatorArguments,
  RequestMessageGeneral,
  ForegroundResponse
} from './types';

let nextProxyInstanceId = 0;

export class TempleLedgerSignerProxy implements Signer {
  private creatorArgs: CreatorArguments;
  private id: number;
  private signer?: Signer;
  private signerPromise?: Promise<Signer>;
  private cleanedUp = false;
  private readonly requestQueue = createQueue();

  constructor(creatorArgs: CreatorArguments) {
    this.creatorArgs = creatorArgs;
    this.id = ++nextProxyInstanceId;
  }

  publicKey = () =>
    this.requestQueue(() => this.requestMethodCall({ name: 'publicKey' }, signer => signer.publicKey()));

  publicKeyHash = () =>
    this.requestQueue(() => this.requestMethodCall({ name: 'publicKeyHash' }, signer => signer.publicKeyHash()));

  sign = (op: string, magicByte?: Uint8Array) =>
    this.requestQueue(() =>
      this.requestMethodCall(
        {
          name: 'sign',
          args: {
            op,
            magicByte: magicByte && uInt8ArrayToString(magicByte)
          }
        },
        signer => signer.sign(op, magicByte)
      )
    );

  async secretKey(): Promise<string | undefined> {
    throw new Error('Secret key cannot be exposed');
  }

  async cleanup() {
    if (this.cleanedUp) return;

    const shouldReleaseForegroundSigner = !this.signer;

    this.cleanedUp = true;
    this.signer = undefined;
    this.signerPromise = undefined;

    if (!shouldReleaseForegroundSigner) {
      return;
    }

    try {
      await browser.runtime.sendMessage({
        type: 'LEDGER_PROXY_RELEASE',
        instanceId: this.id
      });
    } catch (error) {
      console.error('Failed to release Ledger proxy signer', error);
    }
  }

  private async requestMethodCall<N extends ProxiedMethodName, FallbackReturn = any>(
    { name: method, args }: { name: N; args?: MethodsSerialArgs[N] },
    fallback: (signer: Signer) => Promise<FallbackReturn>
  ) {
    if (this.signer) return fallback(this.signer);

    const message: RequestMessageGeneral = {
      type: 'LEDGER_PROXY_REQUEST',
      instanceId: this.id,
      creatorArgs: this.creatorArgs,
      method,
      args
    };

    const response: ForegroundResponse<MethodsReturns[N]> = await browser.runtime.sendMessage(message);

    if (response.type === 'success') return response.value;

    if (response.type === 'refusal') {
      /* Foreground proactively refused to handle request */
      const signer = await this.getOrCreateFallbackSigner(response.transportType);

      return fallback(signer);
    }

    throw new PublicError(response.message);
  }

  private async getOrCreateFallbackSigner(transportType: TransportType) {
    if (this.signer) return this.signer;

    if (!this.signerPromise) {
      this.signerPromise = (async () => {
        const createLedgerSigner = (await import('../index')).createLedgerSigner;
        const { derivationPath, derivationType, publicKey, publicKeyHash } = this.creatorArgs;
        const { signer } = await createLedgerSigner(
          transportType,
          derivationPath,
          derivationType,
          publicKey,
          publicKeyHash
        );

        this.signer = signer;

        return signer;
      })();
    }

    try {
      return await this.signerPromise;
    } finally {
      this.signerPromise = undefined;
    }
  }
}
