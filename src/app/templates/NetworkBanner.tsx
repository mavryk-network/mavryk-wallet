import React, { FC, useMemo } from 'react';

import classNames from 'clsx';

import Name from 'app/atoms/Name';
import { T, t } from 'lib/i18n';
import { useAllNetworks } from 'lib/temple/front';

type NetworkBannerProps = {
  rpc: string;
  narrow?: boolean;
};

const NetworkBanner: FC<NetworkBannerProps> = ({ rpc, narrow = false }) => {
  const allNetworks = useAllNetworks();
  const knownNetwork = useMemo(() => allNetworks.find(n => n.rpcBaseURL === rpc), [allNetworks, rpc]);

  return (
    <div className={classNames('flex flex-col w-full', narrow ? '-mt-1 mb-2' : 'mb-3')}>
      <h2 className="leading-tight flex flex-col">
        {knownNetwork ? (
          <div className="mb-1 flex items-center">
            <div
              className="mr-2 w-6 h-6 border border-primary-white rounded-full"
              style={{
                backgroundColor: knownNetwork.color
              }}
            />

            <span className="text-white text-base-plus">
              {knownNetwork.nameI18nKey ? t(knownNetwork.nameI18nKey) : knownNetwork.name}
            </span>
          </div>
        ) : (
          <div className="w-full mb-1 flex items-center">
            <div
              className={classNames(
                'flex-shrink-0 mr-1 w-3 h-3 bg-primary-error',
                'border border-primary-white rounded-full'
              )}
            />

            <span className="flex-shrink-0 mr-2 text-xs font-medium uppercase text-primary-error">
              <T id="unknownNetwork" />
            </span>

            <Name className="text-xs font-mono italic text-gray-900" style={{ maxWidth: '15rem' }}>
              {rpc}
            </Name>
          </div>
        )}
      </h2>
    </div>
  );
};

export default NetworkBanner;
