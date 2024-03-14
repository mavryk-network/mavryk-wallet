import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

interface TemplateProps extends PropsWithChildren {
  title: ReactNode;
}

export const Template: FC<TemplateProps> = ({ title, children }) => (
  <div>
    <h1 className={classNames('mb-2', 'text-xl leading-6 tracking-tight text-white text-center')}>{title}</h1>
    {children}
  </div>
);
