import type { DerivationType } from '@mavrykdynamics/webmavryk-ledger-signer';

export { TransportType } from './transport/types';

export type LedgerCleanup = () => void | Promise<void>;

export type CreatorArgumentsTuple = [
  derivationPath: string,
  derivationType?: DerivationType,
  publicKey?: string,
  publicKeyHash?: string
];
