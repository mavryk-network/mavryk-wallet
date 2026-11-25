import { Browser } from 'puppeteer-core';

import { BrowserContext } from '../classes/browser-context.class';

import { getExtensionId } from './browser.utils';

export const initBrowserContext = async (browser: Browser) => {
  const extensionId = await getExtensionId(browser);
  const [page] = await browser.pages();

  BrowserContext.EXTENSION_ID = extensionId;
  BrowserContext.browser = browser;
  BrowserContext.page = page ?? (await browser.newPage());
};
