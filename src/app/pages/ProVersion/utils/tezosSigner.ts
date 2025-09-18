import { MavrykToolkit } from '@mavrykdynamics/taquito';
import { InMemorySigner } from '@mavrykdynamics/taquito-signer';

import { EnvVars } from 'lib/env';
import { KYC_CONTRACTS } from 'lib/route3/constants';
import { loadContract } from 'lib/temple/contract';
import { isKnownChainId } from 'lib/temple/types';

const { SUPER_ADMIN_PRIVATE_KEY } = EnvVars;

export const signerTezos = (rpcUrl: string) => {
  if (!rpcUrl) {
    throw new Error('No RPC_URL defined.');
  }

  const TezToolkit = new MavrykToolkit(rpcUrl);

  if (!SUPER_ADMIN_PRIVATE_KEY) {
    throw new Error('No FAUCET_PRIVATE_KEY defined.');
  }

  // Create signer
  TezToolkit.setProvider({
    signer: new InMemorySigner(SUPER_ADMIN_PRIVATE_KEY)
  });

  return TezToolkit;
};

export const signKYCAction = async (rpcUrl: string, address: string, chainId: string | null | undefined) => {
  try {
    if (chainId && isKnownChainId(chainId)) {
      const tezos = signerTezos(rpcUrl);
      const kycAddress = KYC_CONTRACTS.get(chainId) ?? '';

      const contract = await loadContract(tezos, kycAddress);

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
    } else {
      throw new Error('Unkown chain Id');
    }
  } catch (e) {
    throw e;
  }
};
