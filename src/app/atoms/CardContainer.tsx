import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

type CardContainerProps = {
  children: ReactNode;
  className?: string;
  bg?: string;
};

export const CardContainer: FC<CardContainerProps> = ({ bg = 'bg-gray-910', children, className }) => {
  return <div className={classNames('p-4 rounded-2xl-plus flex flex-col', bg, className)}>{children}</div>;
};
