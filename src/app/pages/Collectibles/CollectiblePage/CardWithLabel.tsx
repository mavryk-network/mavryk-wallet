import React, { FC, ReactNode } from 'react';

import clsx from 'clsx';

import { CardContainer } from 'app/atoms/CardContainer';

type CardWithLabelProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
};

export const CardWithLabel: FC<CardWithLabelProps> = ({ label, children, className }) => {
  return (
    <div className={clsx(className)}>
      <div className="text-white text-base-plus mb-3">{label}</div>

      <CardContainer className="text-white text-base-plus">{children}</CardContainer>
    </div>
  );
};
