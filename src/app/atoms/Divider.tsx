import React, { FC } from 'react';

import clsx from 'clsx';

interface DividerProps {
  style?: React.CSSProperties;
  className?: string;
  ignoreParent?: boolean;
}

const Divider: FC<DividerProps> = ({ style, className, ignoreParent = false }) => (
  <div
    style={{
      height: '1px',
      ...style
    }}
    className={clsx('w-full bg-accent-blue', className, ignoreParent && 'relative w-screen -left-4')}
  />
);

export default Divider;
