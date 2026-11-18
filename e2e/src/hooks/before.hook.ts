import { Before } from '@cucumber/cucumber';
import retry from 'async-retry';

import { BrowserContext } from '../classes/browser-context.class';
import { RETRY_OPTIONS, MEDIUM_TIMEOUT } from '../utils/timing.utils';

Before({ timeout: MEDIUM_TIMEOUT }, async () => {
  await BrowserContext.page.close().catch(() => void 0);

  const url = `chrome-extension://${BrowserContext.EXTENSION_ID}/fullpage.html`;

  const page = await retry(async () => {
    const page = await BrowserContext.browser.newPage();
    await page.setViewport({
      height: 800,
      width: 1300
    });
    try {
      const response = await page.goto(url);
      if (response == null || !response.ok) throw new Error('Failed to open page');
      // The extension opens its own tab on install; a background tab never runs rAF, which hangs element clicks
      await page.bringToFront();
      if (process.env.E2E_PAGE_ERRORS) {
        // eslint-disable-next-line no-console
        page.on('pageerror', (err: unknown) => console.log('PAGEERROR:', String(err instanceof Error ? err.stack : err).slice(0, 1500)));
        page.on('console', msg => {
          // eslint-disable-next-line no-console
          if (msg.type() === 'error') console.log('CONSOLE-ERROR:', msg.text().slice(0, 1500));
        });
      }
      return page;
    } catch (error) {
      await page.close();
      throw error;
    }
  }, RETRY_OPTIONS);

  BrowserContext.page = page;
  BrowserContext.resetPrivates();
});
