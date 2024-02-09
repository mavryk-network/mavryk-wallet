import React, { ReactNode, FC } from 'react';

import { Anchor } from './Anchor';

export type AlertWithActionProps = {
  children: ReactNode;
  btnLabel: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  linkTo?: string;
};

export const AlertWithAction: FC<AlertWithActionProps> = ({ children, linkTo, btnLabel, onClick }) => {
  const baseProps = {
    children: <>{btnLabel}</>,
    className: 'text-sm tracking-normal bg-accent-blue text-white py-1 px-10px text-center ml-3 rounded cursor-pointer'
  };

  return (
    <section className="bg-accent-blue-hover p-2 text-sm text-gray-410 flex items-center justify-between rounded-lg">
      <div>{children}</div>
      {linkTo ? <Anchor href={linkTo} {...baseProps} /> : <div {...baseProps} onClick={onClick} />}
    </section>
  );
};
