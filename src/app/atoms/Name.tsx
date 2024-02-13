import React, { FC, HTMLAttributes } from 'react';

import classNames from 'clsx';

import { setTestID, TestIDProps } from 'lib/analytics';
import { merge } from 'lib/utils/merge';

type NameProps = HTMLAttributes<HTMLDivElement> & TestIDProps;

const Name: FC<NameProps> = ({ className, style = {}, testID, ...rest }) => (
  <div
    className={merge('whitespace-nowrap overflow-x-auto truncate no-scrollbar', className)}
    style={{ maxWidth: '12rem', ...style }}
    {...setTestID(testID)}
    {...rest}
  />
);

export default Name;
