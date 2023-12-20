import React, { HTMLAttributes } from 'react';

import classNames from 'clsx';

import { TestIDProps } from 'lib/analytics';

import styles from './BgImageLayout.module.css';

export type BgImageLayoutProps = {
  src: string;
} & TestIDProps &
  HTMLAttributes<HTMLDivElement>;

export const BgImageLayout = ({ src, className, style = {}, children, ...rest }: BgImageLayoutProps) => {
  return (
    <div
      className={classNames(styles.bgImageWrapper, className)}
      style={
        {
          '--img-src': `url('${src}')`,
          ...style
        } as React.CSSProperties
      }
      {...rest}
    >
      {children}
    </div>
  );
};
