import retry from 'async-retry';
import fs from 'fs';
import path from 'path';
import { Browser, launch } from 'puppeteer-core';

import { envVars } from './env.utils';
import { RETRY_OPTIONS } from './timing.utils';
const EXTENSION_PATH = path.resolve(__dirname, '../../../dist/chrome_unpacked');

const CHROME_EXECUTABLE_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

const getChromeExecutablePath = () => {
  if (envVars.E2E_CHROME_EXECUTABLE_PATH) return envVars.E2E_CHROME_EXECUTABLE_PATH;

  const executablePath = CHROME_EXECUTABLE_PATHS.find(candidate => fs.existsSync(candidate));

  if (!executablePath) {
    throw new Error(
      'Chrome executable was not found. Set E2E_CHROME_EXECUTABLE_PATH in e2e/.env before running E2E tests.'
    );
  }

  return executablePath;
};

export const initBrowser = () =>
  launch({
    executablePath: getChromeExecutablePath(),
    headless: envVars.E2E_HEADLESS !== 'false',
    ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages', '--disable-extensions'],
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--user-agent=E2EPipeline/0.0.1',
      '--start-fullscreen',
      '--disable-notifications',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    slowMo: 10
  });

export const getExtensionId = async (browser: Browser) => {
  const background = await retry(async () => {
    const extensionTargets = browser.targets().filter(target => target.url().startsWith('chrome-extension://'));
    const background = extensionTargets.find(target => target.type() === 'service_worker');

    if (background == null) throw new Error(`Extension service worker not found`);

    return background;
  }, RETRY_OPTIONS);

  return new URL(background.url()).hostname;
};
