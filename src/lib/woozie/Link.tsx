import React, { AnchorHTMLAttributes, MouseEventHandler, forwardRef, useCallback, useMemo } from 'react';

import { TestIDProps, useAnalytics, AnalyticsEventCategory, setTestID } from 'lib/analytics';

import { USE_LOCATION_HASH_AS_URL } from './config';
import { HistoryAction, createUrl, changeState } from './history';
import { To, createLocationUpdates, useLocation } from './location';

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, TestIDProps {
  to: To;
  replace?: boolean;
  state?: any;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ to, replace, state = {}, ...rest }, ref) => {
  const lctn = useLocation();

  const { pathname, search, hash, state: internalState } = useMemo(() => createLocationUpdates(to, lctn), [to, lctn]);

  const url = useMemo(() => createUrl(pathname, search, hash), [pathname, search, hash]);

  const href = useMemo(() => (USE_LOCATION_HASH_AS_URL ? `${window.location.pathname}#${url}` : url), [url]);

  const handleNavigate = useCallback(() => {
    const action =
      replace || url === createUrl(lctn.pathname, lctn.search, lctn.hash) ? HistoryAction.Replace : HistoryAction.Push;
    changeState(action, { ...internalState, ...state }, url);
  }, [replace, url, lctn.pathname, lctn.search, lctn.hash, internalState, state]);

  return <LinkAnchor ref={ref} {...rest} href={href} onNavigate={handleNavigate} />;
});

interface LinkAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement>, TestIDProps {
  onNavigate: () => void;
  onClick?: MouseEventHandler;
  target?: string;
}

const LinkAnchor = forwardRef<HTMLAnchorElement, LinkAnchorProps>(
  ({ children, onNavigate, onClick, target, testID, testIDProperties, ...rest }, ref) => {
    const { trackEvent } = useAnalytics();

    const handleClick = useCallback(
      (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        testID && trackEvent(testID, AnalyticsEventCategory.ButtonPress, testIDProperties);

        try {
          if (onClick) {
            onClick(evt);
          }
        } catch (err: any) {
          evt.preventDefault();
          throw err;
        }

        if (
          !evt.defaultPrevented && // onClick prevented default
          evt.button === 0 && // ignore everything but left clicks
          (!target || target === '_self') && // let browser handle "target=_blank" etc.
          !isModifiedEvent(evt) // ignore clicks with modifier keys
        ) {
          evt.preventDefault();
          onNavigate();
        }
      },
      [onClick, target, onNavigate, trackEvent, testID, testIDProperties]
    );

    return (
      <a ref={ref} onClick={handleClick} target={target} {...rest} {...setTestID(testID)}>
        {children}
      </a>
    );
  }
);

function isModifiedEvent(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
