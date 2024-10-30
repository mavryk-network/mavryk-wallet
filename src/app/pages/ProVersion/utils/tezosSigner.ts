import { TezosToolkit } from '@mavrykdynamics/taquito';
import { InMemorySigner } from '@mavrykdynamics/taquito-signer';

import { EnvVars } from 'lib/env';

const { SUPER_ADMIN_PRIVATE_KEY } = EnvVars;

export const signerTezos = (rpcUrl: string) => {
  if (!rpcUrl) {
    throw new Error('No RPC_URL defined.');
  }

  const TezToolkit = new TezosToolkit(rpcUrl);

  if (!SUPER_ADMIN_PRIVATE_KEY) {
    throw new Error('No FAUCET_PRIVATE_KEY defined.');
  }

  // Create signer
  TezToolkit.setProvider({
    signer: new InMemorySigner(SUPER_ADMIN_PRIVATE_KEY)
  });

  return TezToolkit;
};
