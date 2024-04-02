import React, { FC, HTMLAttributes } from 'react';

import classNames from 'clsx';

import { ReactComponent as ArrowIcon } from 'app/icons/chevron-down.svg';
import { ReactComponent as LogoIcon } from 'app/misc/mavryk/logo-small.svg';
import { useBlockExplorer } from 'lib/temple/front';

import styles from './style.module.css';

export const NetworkButton: FC<HTMLAttributes<HTMLDivElement>> = ({ onClick, className, ...rest }) => {
  // preload networks for networks modal (if remove this line, the modal wont be opened)
  useBlockExplorer();
  return (
    <section
      {...rest}
      className={classNames(styles.dappsDropdown, 'px-3 py-2 bg-primary-bg text-white rounded-2xl-plus', className)}
      onClick={onClick}
    >
      <div className="flex gap-1">
        <LogoIcon className="w-4 h-4" />
        <ArrowIcon className="w-4 h-4 stroke-2" />
      </div>
    </section>
  );
};
