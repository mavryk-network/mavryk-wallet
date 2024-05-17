import React, { FC, useCallback, useMemo, useState } from 'react';

import clsx from 'clsx';

import { Spinner } from 'app/atoms';
import { RadioButton } from 'app/atoms/RadioButton';
import { useAppEnv } from 'app/env';
import { ButtonLink } from 'app/molecules/ButtonLink/ButtonLink';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { T } from 'lib/i18n';
import {
  BLOCK_EXPLORERS,
  useAllNetworks,
  useBlockExplorer,
  useChainId,
  useNetwork,
  useSetNetworkId
} from 'lib/temple/front';
import { loadChainId } from 'lib/temple/helpers';
import { TempleNetwork, isKnownChainId } from 'lib/temple/types';

import { NetworkSelectors } from './NetworkPoopup.selectors';

type NetworkPopupProps = {
  setOpened: (v: boolean) => void;
};

export const NetworkPopup: FC<NetworkPopupProps> = ({ setOpened }) => {
  // return <div className="text-white">dsadasdas</div>;
  const allNetworks = useAllNetworks();
  const currentNetwork = useNetwork();
  const setNetworkId = useSetNetworkId();
  const { popup } = useAppEnv();

  const chainId = useChainId(true)!;
  const { setExplorerId } = useBlockExplorer();
  const [isNetworkSwitching, setisNetworkSwitching] = useState(false);

  const filteredNetworks = useMemo(() => allNetworks.filter(n => !n.hidden), [allNetworks]);

  const handleNetworkSelect = useCallback(
    async (netId: string, rpcUrl: string, selected: boolean, setOpened: (o: boolean) => void) => {
      if (selected) {
        setOpened(false);
        return;
      }
      try {
        setisNetworkSwitching(true);
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
        setisNetworkSwitching(false);
        console.error(error);
      }

      setNetworkId(netId);
      setisNetworkSwitching(false);
      setOpened(false);
    },
    [setNetworkId, chainId, setExplorerId]
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
    <div className={clsx('flex flex-col', popup ? 'px-4' : 'px-12')}>
      <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 380 }}>
        {isNetworkSwitching ? (
          <div className="flex items-center justify-center">
            <Spinner className="w-20" />
          </div>
        ) : (
          filteredNetworks.map(network => {
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
          })
        )}
      </div>
      <ButtonLink {...action}>
        <ButtonRounded disabled={isNetworkSwitching} size="big" fill={false} className="w-full mt-6">
          <T id="addNetwork" />
        </ButtonRounded>
      </ButtonLink>
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
    <div className="flex items-center justify-between py-3 cursor-pointer" onClick={onClick}>
      <div className="flex items-center">
        <span className="w-6 h-6 mr-3 rounded-full" style={{ backgroundColor: color }}></span>
        <span className="text-base-plus text-white">{(nameI18nKey && <T id={nameI18nKey} />) || name}</span>
      </div>
      <RadioButton id={id} checked={selected} disabled={disabled} shouldUseChangeHandler />
    </div>
  );
};
