import { Mutex } from 'async-mutex';

import { removeMFromDerivationPath } from './helpers';
import { TempleLedgerSigner } from './signer';
import { TransportType, TempleLedgerTransport } from './transport';
import type { CreatorArgumentsTuple, LedgerCleanup } from './types';

export const createLedgerSigner = async (
  transportType: TransportType,
  ...[derivationPath, derivationType, publicKey, publicKeyHash]: CreatorArgumentsTuple
) => {
  const transport = await createLedgerTransport(transportType);

  const signer = new TempleLedgerSigner(
    transport,
    removeMFromDerivationPath(derivationPath),
    true,
    derivationType,
    publicKey,
    publicKeyHash
  );

  // Keep the shared transport alive across operations to avoid reopening the device.
  const cleanup: LedgerCleanup = () => {};

  return { signer, cleanup };
};

let keptTransport: TempleLedgerTransport | undefined;
let pendingTransport: Promise<TempleLedgerTransport> | undefined;
const transportMutex = new Mutex();

const createLedgerTransport = async (transportType: TransportType) => {
  return transportMutex.runExclusive(async () => {
    if (keptTransport) {
      keptTransport.updateTransportType(transportType);
      return keptTransport;
    }

    if (!pendingTransport) {
      pendingTransport = Promise.resolve().then(() => {
        const transport = new TempleLedgerTransport(transportType);
        keptTransport = transport;

        return transport;
      });
    }

    try {
      const transport = await pendingTransport;
      transport.updateTransportType(transportType);

      return transport;
    } finally {
      pendingTransport = undefined;
    }
  });
};
