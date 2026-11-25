import browser, { Runtime, Tabs } from 'webextension-polyfill';

import { classifyIntercomPort, IntercomPortKind } from './server';

const buildPort = (sender: Runtime.MessageSender) =>
  ({
    sender
  } as Runtime.Port);

describe('classifyIntercomPort', () => {
  beforeAll(() => {
    Object.defineProperty(browser.runtime, 'id', {
      configurable: true,
      value: 'extension-id'
    });
    jest.spyOn(browser.runtime, 'getURL').mockImplementation(path => `chrome-extension://extension-id/${path}`);
  });

  it('classifies extension pages separately from content-script relay ports', () => {
    expect(
      classifyIntercomPort(
        buildPort({
          id: browser.runtime.id,
          url: browser.runtime.getURL('popup.html')
        })
      ).kind
    ).toBe(IntercomPortKind.ExtensionUi);

    expect(
      classifyIntercomPort(
        buildPort({
          id: browser.runtime.id,
          url: browser.runtime.getURL('confirm.html#?id=1')
        })
      ).kind
    ).toBe(IntercomPortKind.ConfirmUi);

    expect(
      classifyIntercomPort(
        buildPort({
          id: browser.runtime.id,
          url: 'https://dapp.example/path',
          tab: { id: 1 } as Tabs.Tab,
          frameId: 0
        })
      )
    ).toMatchObject({
      kind: IntercomPortKind.ContentScriptRelay,
      tabId: 1,
      frameId: 0
    });
  });

  it('does not trust ports from another extension id', () => {
    expect(
      classifyIntercomPort(
        buildPort({
          id: 'another-extension',
          url: browser.runtime.getURL('popup.html')
        })
      ).kind
    ).toBe(IntercomPortKind.Unknown);
  });
});
