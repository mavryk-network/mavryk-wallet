import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

type CardContainerProps = {
  children: ReactNode;
  className?: string;
};

export const CardContainer: FC<CardContainerProps> = ({ children, className }) => {
  return <div className={classNames('p-4 bg-gray-910 rounded-2xl-plus flex flex-col', className)}>{children}</div>;
};
