import React, { ReactNode, FC } from 'react';

import clsx from 'clsx';

import { Anchor } from './Anchor';

export type AlertWithActionProps = {
  children: ReactNode;
  btnLabel: string | React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  linkTo?: string;
  disabled?: boolean;
};

export const AlertWithAction: FC<AlertWithActionProps> = ({ children, linkTo, btnLabel, onClick, disabled }) => {
  const baseProps = {
    children: <div className={clsx(disabled && 'opacity-50 pointer-events-none cursor-not-allowed')}>{btnLabel}</div>,
    className: 'text-sm tracking-normal bg-accent-blue text-white py-1 px-10px text-center ml-3 rounded cursor-pointer'
  };

  return (
    <section
      className={clsx('bg-accent-blue-hover p-2 text-sm text-gray-410 flex items-center justify-between rounded-lg')}
    >
      <div>{children}</div>
      {linkTo ? <Anchor href={linkTo} {...baseProps} /> : <div {...baseProps} onClick={onClick} />}
    </section>
  );
};
