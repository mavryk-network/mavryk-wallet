import React, { FC } from 'react';

import clsx from 'clsx';

interface DividerProps {
  style?: React.CSSProperties;
  className?: string;
  ignoreParent?: boolean;
  color?: 'bg-accent-blue' | 'bg-divider';
}

const Divider: FC<DividerProps> = ({ style, className, color = 'bg-accent-blue', ignoreParent = false }) => (
  <div
    style={{
      height: 1,
      ...style
    }}
    className={clsx('w-full', color, className, ignoreParent && 'relative w-screen -left-4')}
  />
);

export const ListItemDivider: FC = () => {
  return <div className="absolute bottom-0 left-4 bg-divider" style={{ height: 1, width: 'calc(100% - 32px)' }} />;
};

export default Divider;
