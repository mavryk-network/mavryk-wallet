// import { ReactComponent as kryptstarLogo } from 'app/icons/kryptstar.svg';
import BigNumber from 'bignumber.js';

import { ReactComponent as MavrykDynamicsLogo } from 'app/icons/mavrykDynamicsLogo.svg';
import { ReactComponent as NodeLogo } from 'app/icons/nodeLogo.svg';
import { ReactComponent as PopsLogo } from 'app/icons/p-ops.svg';
import { ReactComponent as RepublicCryptoLogo } from 'app/icons/republicCrypto.svg';
import { ReactComponent as SimplyStakingLogo } from 'app/icons/simplyStaking.svg';
import { ReactComponent as ValidatorsLogo } from 'app/icons/validatorsLogo.svg';
import KryptstarLogo from 'app/misc/bakers/krypstar.png';

export const DEFAULT_CYCLE_DURATION_MS = new BigNumber(245721600); // ~ 2.8 days as default value if RPC call fails
export const DEFAULT_BLOCK_DELAY = 10; // ~ 2.8 days as default value if RPC call fails

export const MANAGE_STAKE = 'Manage Stake';
export const CO_STAKE = 'Co-stake';
export const UNLOCK_STAKE = 'Unlock Stake';
export const UNLOCKING = 'Unlocking';
export const FINALIZE_UNLOCK = 'Finalize Unlock';

export const PREDEFINED_BAKERS_NAMES_MAINNET = {
  mv1Tgom8dLnEuq37rTBKDXFZBLS7YU5iSXtW: {
    logo: SimplyStakingLogo,
    name: 'Simply Staking',
    fee: 0.1,
    minDelegation: 10000000,
    minPayout: 1000
  },
  mv1MtuibrK2PZpbJLhe1zkxfLq9HXwRsFWuZ: {
    logo: PopsLogo,
    name: 'P-OPS Team',
    fee: 0,
    minDelegation: 10000000,
    minPayout: 1000
  },
  mv1AJ6Xu1mPFbxFintz1hoQ1aGC98knXsTni: {
    logo: NodeLogo,
    name: 'Node.Monster',
    fee: 0.1,
    minDelegation: 10000000,
    minPayout: 1000
  },
  mv1KryptaWtsDi7EozpfoBjKbKbf4zgMvpj8: {
    logo: KryptstarLogo,
    name: 'Kryptstar',
    fee: 0.1,
    minDelegation: 1000000,
    minPayout: 1000
  },
  mv1C9zN9ZzP1KicMHjBXk9ctJ4k7xq8J9gqU: {
    logo: RepublicCryptoLogo,
    name: 'Republic Crypto',
    fee: 0.1,
    minDelegation: 1000000,
    minPayout: 1000
  },
  mv1DYzNBa1zgmgQieaQKzLxU1sV3aQSArNJ2: {
    logo: MavrykDynamicsLogo,
    name: 'Mavryk Dynamics 1',
    fee: 0.1,
    minDelegation: 10000000,
    minPayout: 1000
  },
  mv1C2iEY1WuBeFQqS9ihxtunHkbUJ28HyeN6: {
    logo: MavrykDynamicsLogo,
    name: 'Mavryk Dynamics 2',
    fee: 0.1,
    minDelegation: 10000000,
    minPayout: 1000
  },
  mv1T9xoFWkkNgy6wH5xeDg9XgdwnqznpuDXs: {
    logo: ValidatorsLogo,
    name: 'Foundation 1',
    fee: 0.15,
    minDelegation: 100000000,
    minPayout: 1000
  },
  mv1CjNm5kcHDBKs5ZwaejxzMUcMVvNGyLC9D: {
    logo: ValidatorsLogo,
    name: 'Foundation 2',
    fee: 0.15,
    minDelegation: 100000000,
    minPayout: 1000
  },
  mv1Bm6GciQqJiKHvm7BvCZoFsZ4YejxTpVpY: {
    logo: ValidatorsLogo,
    name: 'Foundation 3',
    fee: 0.15,
    minDelegation: 100000000,
    minPayout: 1000
  },
  mv1KscSac2FXLeksvSChMMaHB8o1p7eJccg3: {
    logo: ValidatorsLogo,
    name: 'Foundation 4',
    fee: 0.15,
    minDelegation: 100000000,
    minPayout: 1000
  },
  mv1FLSR4ExbtVk4DSdq9N9hFnQ8GxSFQQuov: {
    logo: ValidatorsLogo,
    name: 'Foundation 5',
    fee: 0.15,
    minDelegation: 100000000,
    minPayout: 1000
  },
  mv1KYxgSRtC4E9WK5bdUVbxXRmfwLMq5PqZU: {
    logo: ValidatorsLogo,
    name: 'Foundation 6',
    fee: 0.15,
    minDelegation: 100000000,
    minPayout: 1000
  },
  mv1F1uHGUvp6DwfokBqMddz6mPZ7imjjg9X5: {
    logo: ValidatorsLogo,
    name: 'Foundation 7',
    fee: 0.15,
    minDelegation: 100000000,
    minPayout: 1000
  },
  mv1FWz2yj1J46kNnw4NkUcuaJdRgZp1tUkz2: {
    logo: ValidatorsLogo,
    name: 'Foundation 8',
    fee: 0.15,
    minDelegation: 100000000,
    minPayout: 1000
  }
};

export const SORTED_PREDEFINED_SPONSORED_BAKERS = Object.keys(PREDEFINED_BAKERS_NAMES_MAINNET);

// Delegate data ------------------------

export const emptyAccountResponse = { delegate: { address: null } };

export const emptydelegateStatsResponse = {
  myBakerPkh: null,
  isDelegated: false,
  isInDelegationPeriod: false,
  isInCostakePeriod: false,
  hasDelegationPeriodPassed: false,
  isInUnlockPeriod: false,
  hasUnlockPeriodPassed: false,
  canRedelegate: false,
  canCostake: false,
  canUnlock: false,
  unlockWaitTime: null,
  costakeWaitTime: null,
  delegationWaitTime: null,
  stakedBalance: 0,
  unstakedBalance: 0
};
