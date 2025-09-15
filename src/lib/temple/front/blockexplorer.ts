import { useMemo } from 'react';

import { isKnownChainId, TempleChainId } from 'lib/temple/types';

import { useChainId } from './ready';
import { useStorage } from './storage';

type BlockExplorerId = 'tzkt' | 'tzstats' | 'bcd' | 't4l3nt';

interface BaseUrls {
  account?: string;
  transaction: string;
  api?: string;
  contract?: string;
}

export type BlockExplorer = {
  id: BlockExplorerId;
  name: string;
  baseUrls: Map<TempleChainId, BaseUrls>;
};

export const BLOCK_EXPLORERS: BlockExplorer[] = [
  {
    id: 'tzkt',
    name: 'Nexus',
    baseUrls: new Map([
      [
        TempleChainId.Mainnet,
        {
          account: 'https://nexus.mavryk.org/explorer/account/',
          transaction: 'https://nexus.mavryk.org/explorer/operation/',
          contract: 'https://nexus.mavryk.org/explorer/contract/',
          api: 'https://api.mavryk.network/v1'
        }
      ],
      [
        TempleChainId.Basenet,
        {
          account: 'https://tzkt.io',
          transaction: 'https://tzkt.io',
          api: 'https://api.mavryk.network/basenet'
        }
      ],
      [
        TempleChainId.Atlas,
        {
          account: 'https://nexus.mavryk.org/explorer/account/',
          transaction: 'https://nexus.mavryk.org/explorer/operation/',
          contract: 'https://nexus.mavryk.org/explorer/contract/',
          api: 'https://atlasnet.api.mavryk.network/v1'
        }
      ],
      [
        TempleChainId.Weekly,
        {
          account: 'https://tzkt.io',
          transaction: 'https://tzkt.io',
          api: 'https://api.mavryk.network/weeklynet'
        }
      ]
    ])
  },
  {
    id: 'tzstats',
    name: 'TzStats',
    baseUrls: new Map([
      [
        TempleChainId.Mainnet,
        {
          account: 'https://tzstats.com',
          transaction: 'https://tzstats.com'
        }
      ]
    ])
  },
  {
    id: 'bcd',
    name: 'Better Call Dev',
    baseUrls: new Map([
      [
        TempleChainId.Mainnet,
        {
          transaction: 'https://better-call.dev/mainnet/opg'
        }
      ]
    ])
  }
];

const BLOCK_EXPLORER_STORAGE_KEY = 'block_explorer';

export function useBlockExplorer() {
  const [explorerId, setExplorerId] = useStorage<BlockExplorerId>(BLOCK_EXPLORER_STORAGE_KEY, 'tzkt');
  const explorer = useMemo(() => BLOCK_EXPLORERS.find(({ id }) => id === explorerId)!, [explorerId]);

  return {
    explorer,
    setExplorerId
  };
}

export function useExplorerBaseUrls(): Partial<BaseUrls> {
  const chainId = useChainId();
  const { explorer } = useBlockExplorer();

  return useMemo(() => {
    if (chainId && isKnownChainId(chainId)) {
      return explorer.baseUrls.get(chainId) ?? {};
    }

    return {};
  }, [chainId, explorer]);
}
