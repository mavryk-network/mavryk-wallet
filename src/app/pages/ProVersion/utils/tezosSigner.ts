import { MavrykToolkit } from '@mavrykdynamics/webmavryk';
import { InMemorySigner } from '@mavrykdynamics/webmavryk-signer';

import { KYC_CONTRACTS } from 'lib/route3/constants';
import { loadContract } from 'lib/temple/contract';
import { isKnownChainId, TempleChainId } from 'lib/temple/types';
import { parseTransferParamsToParamsWithKind } from 'lib/utils/parse-transfer-params';

const MEMBER_KYC_ACTION = 'addMemberKyc';
const DEFAULT_MEMBERSHIP_TIER = 'Starter';
const DEFAULT_KYC_FIELD_VALUE = 'NIL';
const CONFIRMATIONS_COUNT = 1;
const PRODUCTION_KYC_SIGNING_ERROR =
  'KYC signing is not available in frontend production builds. Server-side signing is required.';
const TESTNET_KYC_SIGNING_ONLY_ERROR = 'Frontend KYC signing is only available on Basenet testnet.';
const TESTNET_KYC_SIGNER_KEY_MISSING_ERROR = 'Testnet KYC signer key is not configured for this frontend build.';

type BigMapLookup = {
  get: (key: string) => Promise<unknown>;
};

type KYCContractStorage = {
  memberLedger: BigMapLookup;
  memberKycLedger: BigMapLookup;
};

const createTezosToolkit = (rpcUrl: string) => {
  if (!rpcUrl) {
    throw new Error('No RPC_URL defined.');
  }

  return new MavrykToolkit(rpcUrl);
};

const getKYCContractAddress = (chainId: string | null | undefined) => {
  if (!chainId || !isKnownChainId(chainId)) {
    throw new Error('Unknown chain Id');
  }

  const kycAddress = KYC_CONTRACTS.get(chainId);

  if (!kycAddress) {
    throw new Error('No KYC_CONTRACT defined.');
  }

  return kycAddress;
};

const getTestnetKYCSignerPrivateKey = (chainId: string | null | undefined) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(PRODUCTION_KYC_SIGNING_ERROR);
  }

  if (!chainId || !isKnownChainId(chainId)) {
    throw new Error('Unknown chain Id');
  }

  if (chainId !== TempleChainId.Basenet) {
    throw new Error(TESTNET_KYC_SIGNING_ONLY_ERROR);
  }

  const testnetSignerPrivateKey = process.env.TESTNET_KYC_SIGNER_PRIVATE_KEY?.trim();

  if (!testnetSignerPrivateKey) {
    throw new Error(TESTNET_KYC_SIGNER_KEY_MISSING_ERROR);
  }

  return testnetSignerPrivateKey;
};

export const signerTezos = (rpcUrl: string, chainId: string | null | undefined) => {
  const TezToolkit = createTezosToolkit(rpcUrl);
  const testnetSignerPrivateKey = getTestnetKYCSignerPrivateKey(chainId);

  // Create signer
  TezToolkit.setProvider({
    signer: new InMemorySigner(testnetSignerPrivateKey)
  });

  return TezToolkit;
};

export const getKYCStatusFromContract = async (rpcUrl: string, address: string, chainId: string | null | undefined) => {
  const tezos = createTezosToolkit(rpcUrl);
  const kycAddress = getKYCContractAddress(chainId);
  const contract = await loadContract(tezos, kycAddress, false);
  const storage = await contract.storage<KYCContractStorage>();
  const [memberData, memberKycData] = await Promise.all([
    storage.memberLedger.get(address),
    storage.memberKycLedger.get(address)
  ]);

  return Boolean(memberData && memberKycData);
};

export const signKYCAction = async (rpcUrl: string, address: string, chainId: string | null | undefined) => {
  const tezos = signerTezos(rpcUrl, chainId);
  const kycAddress = getKYCContractAddress(chainId);
  const contract = await loadContract(tezos, kycAddress);

  const memberLedgerList = [
    {
      updateType: 'update',
      memberAddress: address,
      membershipTier: DEFAULT_MEMBERSHIP_TIER
    }
  ];
  const memberKycList = [
    {
      memberAddress: address,
      country: DEFAULT_KYC_FIELD_VALUE,
      region: DEFAULT_KYC_FIELD_VALUE,
      investorType: DEFAULT_KYC_FIELD_VALUE
    }
  ];

  const operation = await tezos.wallet
    .batch([
      parseTransferParamsToParamsWithKind(contract.methods.setMember(memberLedgerList).toTransferParams()),
      parseTransferParamsToParamsWithKind(
        contract.methods.setMemberKyc(MEMBER_KYC_ACTION, memberKycList).toTransferParams()
      )
    ])
    .send();

  await operation.confirmation(CONFIRMATIONS_COUNT);

  return operation;
};
