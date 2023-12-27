import React, { FC, HTMLAttributes, useCallback, useMemo } from 'react';

import classNames from 'clsx';

import { ReactComponent as LoadingSvg } from 'app/icons/loading.svg';
import { T } from 'lib/i18n';
import {
  BLOCK_EXPLORERS,
  useBlockExplorer,
  useAllNetworks,
  useChainId,
  useNetwork,
  useSetNetworkId
} from 'lib/temple/front';
import { loadChainId } from 'lib/temple/helpers';
import { TempleNetwork, isKnownChainId } from 'lib/temple/types';

type NetworkPopupProps = {
  opened: boolean;
  setOpened: (v: boolean) => void;
};

export const NetworkPopup: FC<NetworkPopupProps> = ({ opened, setOpened }) => {
  const allNetworks = useAllNetworks();
  const currentNetwork = useNetwork();
  const setNetworkId = useSetNetworkId();

  const chainId = useChainId();
  const { setExplorerId } = useBlockExplorer();

  const filteredNetworks = useMemo(() => allNetworks.filter(n => !n.hidden), [allNetworks]);

  const handleNetworkSelect = useCallback(
    async (netId: string, rpcUrl: string, selected: boolean, setOpened: (o: boolean) => void) => {
      setOpened(false);

      if (selected) return;

      try {
        const currentChainId = await loadChainId(rpcUrl);

        if (currentChainId && isKnownChainId(currentChainId)) {
          const currentBlockExplorerId =
            BLOCK_EXPLORERS.find(explorer => explorer.baseUrls.get(currentChainId))?.id ?? 'tzkt';

          if (currentChainId !== chainId) {
            setExplorerId(currentBlockExplorerId);
          }
        } else if (currentChainId !== chainId) {
          setExplorerId('tzkt');
        }
      } catch (error) {
        console.error(error);
      }

      setNetworkId(netId);
      // navigate('/', HistoryAction.Replace);
    },
    [setNetworkId, setExplorerId, chainId]
  );

  if (!chainId)
    return (
      <div className="animate-spin flex justify-center items-center p-8">
        <LoadingSvg style={{ width: 24, height: 24 }} />
      </div>
    );

  return (
    <div className="px-4">
      {filteredNetworks.map(network => {
        const { id, rpcBaseURL } = network;
        const selected = id === currentNetwork.id;

        return (
          <NetworkListItem
            key={id}
            network={network}
            selected={selected}
            onClick={() => handleNetworkSelect(id, rpcBaseURL, selected, setOpened)}
          />
        );
      })}
    </div>
  );
};

interface NetworkListItemProps {
  network: TempleNetwork;
  selected: boolean;
  onClick: EmptyFn;
}

const NetworkListItem: FC<NetworkListItemProps> = ({ network, selected, onClick }) => {
  const { id, name, color, disabled, nameI18nKey } = network;

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center">
        <span className="w-6 h-6 mr-3 rounded-full" style={{ backgroundColor: color }}></span>
        <span className="text-base-plus text-white">{(nameI18nKey && <T id={nameI18nKey} />) || name}</span>
      </div>
    </div>
  );
};
