import React, { ComponentProps, FC, HTMLAttributes } from 'react';

import classNames from 'clsx';

import { ReactComponent as CopyIcon } from 'app/icons/copy.svg';

import CopyButton, { CopyButtonProps } from './CopyButton';
import HashShortView from './HashShortView';

type HashChipProps = HTMLAttributes<HTMLButtonElement> &
  ComponentProps<typeof HashShortView> &
  Pick<CopyButtonProps, 'small' | 'type' | 'bgShade' | 'rounded' | 'textShade'> & { showIcon?: boolean };

export const HashChip: FC<HashChipProps> = ({
  hash,
  trim,
  trimAfter,
  firstCharsCount,
  lastCharsCount,
  className,
  type = 'button',
  showIcon = true,
  ...rest
}) => (
  <CopyButton
    text={hash}
    type={type}
    className={classNames(className, showIcon && 'flex gap-x-1 items-center text-blue-200')}
    {...rest}
  >
    <HashShortView
      hash={hash}
      trimAfter={trimAfter}
      firstCharsCount={firstCharsCount}
      lastCharsCount={lastCharsCount}
    />
    {showIcon && <CopyIcon className="stroke-cyan w-4 h-4" />}
  </CopyButton>
);
