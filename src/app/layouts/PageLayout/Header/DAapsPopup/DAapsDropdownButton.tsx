import React, { FC } from 'react';

import classNames from 'clsx';

import { ReactComponent as EnabledNetworkIcon } from 'app/icons/connect-green.svg';
import { ReactComponent as DisabledNetworkIcon } from 'app/icons/connect-grey.svg';

import { useDappsContext } from './DAppsPopup';

export type NetworkButtonProps = {
  enabled?: boolean;
  className?: string;
  onClick: () => void;
};

export const DAapsDropdownButton: FC<NetworkButtonProps> = ({ className, onClick }) => {
  const { activeDAppEntry } = useDappsContext();
  const Icon = Boolean(activeDAppEntry) ? EnabledNetworkIcon : DisabledNetworkIcon;

  return <Icon className={classNames('w-6 h-6 cursor-pointer', className)} onClick={onClick} />;
};
