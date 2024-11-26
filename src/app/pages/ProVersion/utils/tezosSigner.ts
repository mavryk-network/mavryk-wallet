import { TezosToolkit } from '@mavrykdynamics/taquito';
import { InMemorySigner } from '@mavrykdynamics/taquito-signer';

import { EnvVars } from 'lib/env';
import { KYC_CONTRACT } from 'lib/route3/constants';
import { loadContract } from 'lib/temple/contract';

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

export const signKYCAction = async (rpcUrl: string, address: string) => {
  try {
    const tezos = signerTezos(rpcUrl);

    const contract = await loadContract(tezos, KYC_CONTRACT);

    const setMemberAction = 'addMember';

    const memberList = [
      {
        memberAddress: address,
        country: 'NIL',
        region: 'NIL',
        investorType: 'NIL'
      }
    ];
    await contract.methods.setMember(setMemberAction, memberList).send();
  } catch (e) {
    throw e;
  }
};
