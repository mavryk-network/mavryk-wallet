import { After } from '@cucumber/cucumber';
import retry from 'async-retry';
import { E2eMessageType } from 'src/lib/e2e/types';

import { BrowserContext } from '../classes/browser-context.class';
import { RETRY_OPTIONS, MEDIUM_TIMEOUT } from '../utils/timing.utils';

const FAILED_RESET_ERROR = new Error('Failed to reset extension');

After({ timeout: MEDIUM_TIMEOUT }, async ({ result, pickle }) => {
  if (process.env.E2E_SCREENSHOT_DIR && result?.status === 'FAILED') {
    await BrowserContext.page
      .screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR}/${pickle.name.replace(/\W+/g, '_').slice(0, 60)}.png` })
      .catch(() => void 0);
  }

  // [ Extension storages full reset ]

  await BrowserContext.page.evaluate(
    // @ts-ignore
    message => new Promise(res => chrome.runtime.sendMessage(message, res)),
    { type: E2eMessageType.ResetRequest }
  );
  await BrowserContext.page.evaluate(() => void localStorage.clear());

  // [ Extension reload ]

  // @ts-ignore
  await BrowserContext.page.evaluate(() => void chrome.runtime.reload()).catch(() => void 0);

  // Newer Chrome may keep the tab open across the reload; close it so the next Before opens a fresh page
  await retry(() => {
    if (BrowserContext.page.isClosed() === false) throw FAILED_RESET_ERROR;
  }, { ...RETRY_OPTIONS, maxRetryTime: 5_000 }).catch(() => BrowserContext.page.close());

  await retry(() => {
    const isWorkerUp = BrowserContext.browser
      .targets()
      .some(t => t.type() === 'service_worker' && t.url().includes(BrowserContext.EXTENSION_ID));
    if (!isWorkerUp) throw FAILED_RESET_ERROR;
  }, RETRY_OPTIONS);
});
