import React, { FC, HTMLAttributes } from 'react';

import classNames from 'clsx';

import { ReactComponent as ArrowIcon } from 'app/icons/chevron-down.svg';
import { useNetwork } from 'lib/temple/front';

import { networkIcons } from './network.const';
import styles from './style.module.css';

export const NetworkButton: FC<HTMLAttributes<HTMLDivElement>> = ({ onClick, className, ...rest }) => {
  const currentNetwork = useNetwork();

  const NetworkIcon = networkIcons[currentNetwork?.id];
  return (
    <section
      {...rest}
      className={classNames(styles.dappsDropdown, 'px-3 py-2 bg-primary-bg text-white rounded-2xl-plus', className)}
      onClick={onClick}
    >
      <div className="flex gap-1">
        <NetworkIcon className="w-4 h-4" />
        <ArrowIcon className="w-4 h-4 stroke-2" />
      </div>
    </section>
  );
};
