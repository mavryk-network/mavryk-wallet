import React, { FC, HTMLAttributes } from 'react';

import classNames from 'clsx';

import { ReactComponent as ArrowIcon } from 'app/icons/chevron-down.svg';
import { ReactComponent as LogoIcon } from 'app/misc/mavryk/logo-small.svg';

import styles from './DAapsPopup.module.css';

export const DAapsDropdownButton: FC<HTMLAttributes<HTMLDivElement>> = ({ onClick, className, ...rest }) => {
  return (
    <section
      onClick={onClick}
      className={classNames(styles.dappsDropdown, 'px-3 py-2 bg-primary-bg text-white rounded-2xl-plus', className)}
      {...rest}
    >
      <div className="flex gap-2">
        <LogoIcon className="w-4 h-auto" />
        <ArrowIcon className="w-4 h-auto stroke-current" />
      </div>
    </section>
  );
};
