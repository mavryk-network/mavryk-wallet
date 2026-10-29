import * as ReactDOM from 'react-dom/client';
import browser from 'webextension-polyfill';

import { setPopupMode } from 'lib/popup-mode';

jest.mock('webextension-polyfill', () => ({
  extension: { getViews: jest.fn() },
  tabs: { create: jest.fn() },
  runtime: { getURL: jest.fn((url: string) => `chrome-extension://test/${url}`) }
}));

jest.mock('./main.css', () => ({}));
jest.mock('lib/store/zustand/start-owned-ui', () => ({}));
jest.mock('app/App', () => ({ App: () => null }));
jest.mock('react-dom/client', () => ({ createRoot: jest.fn() }));

const render = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  window.history.replaceState(null, '', '/popup.html?network=basenet#/settings/general');
  jest.spyOn(window, 'close').mockImplementation(() => undefined);
  jest.spyOn(ReactDOM, 'createRoot').mockReturnValue({ render, unmount: jest.fn() });
});

afterEach(() => jest.restoreAllMocks());

it.each([
  [true, true, false],
  [true, false, true],
  [false, true, true],
  [false, false, true]
])('bootstraps popup view=%s, popup preference=%s, redirect=%s', (isPopup, isPopupEnabled, shouldRedirect) => {
  setPopupMode(isPopupEnabled);
  jest.spyOn(browser.extension, 'getViews').mockReturnValue(isPopup ? [window] : []);

  jest.isolateModules(() => require('./popup'));

  if (shouldRedirect) {
    expect(ReactDOM.createRoot).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    expect(browser.tabs.create).toHaveBeenCalledTimes(1);
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test/fullpage.html?network=basenet#/settings/general'
    });
    expect(browser.runtime.getURL).toHaveBeenCalledWith('fullpage.html?network=basenet#/settings/general');
    expect(window.close).toHaveBeenCalledTimes(1);
  } else {
    expect(ReactDOM.createRoot).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(window.close).not.toHaveBeenCalled();
  }
  expect(localStorage.getItem('popup_mode')).toBe(String(isPopupEnabled));
});
