import React, { FC, useMemo } from 'react';

import clsx from 'clsx';

import { ReactComponent as LinkSvgIcon } from 'app/icons/external-link.svg';
import { ReactComponent as ArrowTopRightSvgIcon } from 'app/icons/m_send.svg';
import type { TestIDProps } from 'lib/analytics';
import useTippy, { UseTippyOptions } from 'lib/ui/useTippy';

import { Anchor } from './Anchor';

export interface ExternalLinkChipProps extends TestIDProps {
  href: string;
  tooltip?: string;
  className?: string;
  alternativeDesign?: boolean;
  arrowIcon?: boolean;
  small?: boolean;
}

export const ExternalLinkChip: FC<ExternalLinkChipProps> = ({
  href,
  tooltip,
  className,
  arrowIcon,
  small,
  alternativeDesign,
  testID,
  testIDProperties
}) => {
  const tippyOptions = useMemo<UseTippyOptions>(
    () => ({
      trigger: 'mouseenter',
      hideOnClick: false,
      content: tooltip,
      animation: 'shift-away-subtle'
    }),
    [tooltip]
  );

  const ref = useTippy<HTMLAnchorElement>(tippyOptions);

  const SvgIcon = arrowIcon ? ArrowTopRightSvgIcon : LinkSvgIcon;

  const linkClassnames = useMemo(
    () =>
      alternativeDesign
        ? clsx('p-1 bg-transparent')
        : clsx(
            'flex items-center justify-center rounded select-none p-1',
            'bg-primary-card transition ease-in-out duration-300',
            className
          ),
    [alternativeDesign, className]
  );

  return (
    <Anchor
      ref={tooltip ? ref : undefined}
      href={href}
      className={linkClassnames}
      treatAsButton={true}
      testID={testID}
      testIDProperties={testIDProperties}
    >
      <SvgIcon className={clsx('stroke-cyan stroke-1', small ? 'h-3 w-3' : 'h-4 w-4')} />
    </Anchor>
  );
};
