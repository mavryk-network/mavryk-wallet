import React, { FC, useMemo, isValidElement } from 'react';

import { renderToString } from 'react-dom/server';
import { Props } from 'tippy.js';

import useTippy from './useTippy';

export type TooltipProps = {
  content: Props['content'] | React.ReactNode;
  additionaltippyProps?: Partial<Props>;
} & PropsWithChildren;

export const Tooltip: FC<TooltipProps> = ({ content, children, additionaltippyProps = {} }) => {
  const tippyProps = useMemo(() => {
    let resolvedContent: unknown = content;

    if (isValidElement(content)) {
      // render to static HTML string
      resolvedContent = renderToString(content);
    } else {
      resolvedContent = content;
    }

    return {
      trigger: 'mouseenter click',
      interactive: true,
      hideOnClick: true,
      animation: 'shift-away-subtle',
      content: resolvedContent as Props['content'],
      allowHTML: true,
      ...additionaltippyProps
    };
  }, [content, additionaltippyProps]);

  const divRef = useTippy<HTMLDivElement>(tippyProps);

  return (
    <div ref={divRef} style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}>
      {children}
    </div>
  );
};
