import { useEffect } from 'react';

import { fromAssetSlug } from 'lib/assets/utils';

import { useAnalytics } from './use-analytics.hook';

const pageRoutesWithToken = ['/explore', '/send', '/nft'];
const pageRoutesWithQueryParams = ['/swap'];

export const usePageRouterAnalytics = (pathname: string, search: string, isContextReady: boolean) => {
  const { pageEvent } = useAnalytics();

  useEffect(() => {
    if (pathname === '/' && !isContextReady) {
      return void pageEvent('/welcome', search);
    }

    if (pageRoutesWithToken.some(route => pathname.startsWith(route))) {
      const [, route = '', tokenSlug = 'mav'] = pathname.split('/');
      const [tokenAddress, tokenId] = fromAssetSlug(tokenSlug);

      return void pageEvent(`/${route}`, search, {
        tokenAddress,
        tokenId
      });
    }

    if (pageRoutesWithQueryParams.some(route => pathname.startsWith(route))) {
      const usp = new URLSearchParams(search);

      const inputAssetSlug = usp.get('from') || 'mav';
      const outputAssetSlug = usp.get('to');

      return void pageEvent(pathname, search, { inputAssetSlug, outputAssetSlug });
    }

    return void pageEvent(pathname, search);
  }, [pathname, search, isContextReady, pageEvent]);
};
