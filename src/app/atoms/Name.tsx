import React, { FC, HTMLAttributes, useMemo } from 'react';

import classNames from 'clsx';
import { Props } from 'tippy.js';

import { setTestID, TestIDProps } from 'lib/analytics';
import useTippy, { UseTippyOptions } from 'lib/ui/useTippy';

type NameProps = HTMLAttributes<HTMLDivElement> &
  TestIDProps & {
    tooltipContent?: Props['content'];
  };

const isTextTruncated = (element: HTMLElement) =>
  element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;

const Name: FC<NameProps> = ({ className, style = {}, testID, tooltipContent, ...rest }) => {
  const tippyProps = useMemo<UseTippyOptions>(
    () => ({
      trigger: 'mouseenter',
      hideOnClick: false,
      content: tooltipContent,
      animation: 'shift-away-subtle',
      onShow(instance) {
        const reference = instance.reference;

        const shouldShow = Boolean(tooltipContent) && reference instanceof HTMLElement && isTextTruncated(reference);

        // tippy's onShow returns `void | false`: false suppresses the tooltip, undefined allows it.
        // (Previously returned a raw boolean — a type error.)
        return shouldShow ? undefined : false;
      }
    }),
    [tooltipContent]
  );

  const ref = useTippy<HTMLDivElement>(tippyProps);

  return (
    <div
      ref={tooltipContent ? ref : undefined}
      className={classNames('whitespace-nowrap overflow-x-auto truncate no-scrollbar', className)}
      style={{ maxWidth: '8rem', ...style }}
      {...setTestID(testID)}
      {...rest}
    />
  );
};

export default Name;
