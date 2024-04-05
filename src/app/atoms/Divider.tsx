import React, { FC } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { merge } from 'lib/utils/merge';

interface DividerProps {
  style?: React.CSSProperties;
  className?: string;
  ignoreParent?: boolean;
  color?: 'bg-accent-blue' | 'bg-divider';
}

const Divider: FC<DividerProps> = ({ style, className, color = 'bg-accent-blue', ignoreParent = false }) => {
  const { fullPage } = useAppEnv();

  return (
    <div
      style={{
        height: 1,
        ...style
      }}
      className={clsx(
        'w-full',
        color,
        className,
        ignoreParent && fullPage ? 'relative left-0 max-w-screen-xxs' : 'relative w-screen -left-4'
      )}
    />
  );
};

export const ListItemDivider: FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={merge('absolute bottom-0 left-4 bg-divider', className)}
      style={{ height: 1, width: 'calc(100% - 32px)' }}
    />
  );
};

export default Divider;
