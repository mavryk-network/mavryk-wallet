import React, { FC, ReactNode } from 'react';

import { Link } from 'lib/woozie';

export type TopbarRightTextProps = {
  onClick?: () => void;
  label: ReactNode;
  linkTo?: string;
};

export const TopbarRightText: FC<TopbarRightTextProps> = ({ onClick, label, linkTo }) => {
  const baseProps = {
    className: 'text-base-plus text-accent-blue cursor-pointer',
    children: label
  };

  return linkTo ? <Link to={linkTo} {...baseProps} /> : <div {...baseProps} onClick={onClick} />;
};
