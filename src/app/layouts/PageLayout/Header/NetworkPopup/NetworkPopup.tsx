import React, { FC, useCallback, useMemo } from 'react';

import { RadioButton } from 'app/atoms/RadioButton';
import { ButtonLink } from 'app/molecules/ButtonLink/ButtonLink';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
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

import { NetworkSelectors } from './NetworkPoopup.selectors';

type NetworkPopupProps = {
  opened: boolean;
  setOpened: (v: boolean) => void;
};

export const NetworkPopup: FC<NetworkPopupProps> = ({ setOpened }) => {
  const allNetworks = useAllNetworks();
  const currentNetwork = useNetwork();
  const setNetworkId = useSetNetworkId();

  const chainId = useChainId(true)!;
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
    },
    [setNetworkId, setExplorerId, chainId]
  );

  const action = useMemo(
    () => ({
      key: 'add-network',
      linkTo: '/add-network',
      testID: NetworkSelectors.networksButton,
      onClick: () => setOpened(false)
    }),
    [setOpened]
  );

  return (
    <>
      <div className="px-4 flex flex-col">
        <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 380 }}>
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
        <ButtonLink {...action}>
          <ButtonRounded size="big" fill={false} className="w-full mt-6">
            <T id="addNetwork" />
          </ButtonRounded>
        </ButtonLink>
      </div>
    </>
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
    <div className="flex items-center justify-between py-3 cursor-pointer" onClick={onClick}>
      <div className="flex items-center">
        <span className="w-6 h-6 mr-3 rounded-full" style={{ backgroundColor: color }}></span>
        <span className="text-base-plus text-white">{(nameI18nKey && <T id={nameI18nKey} />) || name}</span>
      </div>
      <RadioButton id={id} checked={selected} disabled={disabled} shouldUseChangeHandler />
    </div>
  );
};
