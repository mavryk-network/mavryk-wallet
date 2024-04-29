import React, { FC, ReactNode } from 'react';

import clsx from 'clsx';

import { CardContainer } from 'app/atoms/CardContainer';

type CardWithLabelProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  cardContainerClassname?: string;
};

export const CardWithLabel: FC<CardWithLabelProps> = ({
  label,
  children,
  className = '',
  cardContainerClassname = ''
}) => {
  return (
    <div className={clsx('overflow-hidden relative', className)}>
      <div className="text-white text-base-plus mb-3">{label}</div>

      <CardContainer className={clsx('text-white text-base-plus', cardContainerClassname)}>{children}</CardContainer>
    </div>
  );
};
