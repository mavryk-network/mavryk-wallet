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
  trim = true,
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
    className={classNames(className, showIcon && 'flex text-sm items-center text-blue-200')}
    {...rest}
  >
    <HashShortView
      hash={hash}
      trimAfter={trimAfter}
      firstCharsCount={firstCharsCount}
      lastCharsCount={lastCharsCount}
      trim={trim}
    />
    {showIcon && <CopyIcon className="text-blue-200 fill-current w-4 h-4 ml-1" />}
  </CopyButton>
);
