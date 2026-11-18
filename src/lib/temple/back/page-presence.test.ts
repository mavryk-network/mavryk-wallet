import browser, { Runtime } from 'webextension-polyfill';

import { WALLET_AUTOLOCK_TIME } from 'lib/fixed-times';

import { hasOpenExtensionPages, scheduleAutolockDeadline, startPagePresenceTracking } from './page-presence';

type Listener = () => void;

const buildPort = (url: string, name = 'INTERCOM') => {
  const disconnectListeners: Listener[] = [];
  const port = {
    name,
    sender: { id: browser.runtime.id, url },
    onDisconnect: { addListener: (listener: Listener) => disconnectListeners.push(listener) }
  } as unknown as Runtime.Port;

  return { port, disconnect: () => disconnectListeners.forEach(listener => listener()) };
};

describe('startPagePresenceTracking', () => {
  let connect: (port: Runtime.Port) => void;
  const onDeadline = jest.fn().mockResolvedValue(undefined);
  const onFirstPage = jest.fn().mockResolvedValue(undefined);

  beforeAll(() => {
    Object.defineProperty(browser.runtime, 'id', { configurable: true, value: 'extension-id' });
    jest.spyOn(browser.runtime, 'getURL').mockImplementation(path => `chrome-extension://extension-id/${path}`);
    jest.spyOn(browser.runtime.onConnect, 'addListener').mockImplementation(listener => {
      connect = listener as (port: Runtime.Port) => void;
    });

    startPagePresenceTracking(onDeadline, onFirstPage);
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    onDeadline.mockClear();
    onFirstPage.mockReset().mockResolvedValue(undefined);
    await browser.storage.local.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const flushPromises = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  const getClosureTimestamp = async () =>
    (await browser.storage.local.get('last_page_closure_timestamp')).last_page_closure_timestamp;

  it('records the closure and schedules the deadline only when the last extension page disconnects', async () => {
    const popup = buildPort(browser.runtime.getURL('popup.html'));
    const confirm = buildPort(browser.runtime.getURL('confirm.html'));

    connect(popup.port);
    connect(confirm.port);
    expect(hasOpenExtensionPages()).toBe(true);

    popup.disconnect();
    expect(hasOpenExtensionPages()).toBe(true);
    expect(await getClosureTimestamp()).toBeUndefined();

    confirm.disconnect();
    expect(hasOpenExtensionPages()).toBe(false);
    expect(typeof (await getClosureTimestamp())).toBe('number');

    jest.advanceTimersByTime(WALLET_AUTOLOCK_TIME);
    expect(onDeadline).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);
    expect(onDeadline).toHaveBeenCalledTimes(1);
  });

  it('cancels the deadline and clears the closure when a page opens again', async () => {
    const first = buildPort(browser.runtime.getURL('fullpage.html'));
    connect(first.port);
    first.disconnect();
    expect(typeof (await getClosureTimestamp())).toBe('number');

    const second = buildPort(browser.runtime.getURL('popup.html'));
    connect(second.port);
    await flushPromises();
    expect(await getClosureTimestamp()).toBeUndefined();

    jest.advanceTimersByTime(WALLET_AUTOLOCK_TIME * 2);
    expect(onDeadline).not.toHaveBeenCalled();

    second.disconnect();
  });

  it('checks the closure deadline before clearing it when the first page opens', async () => {
    const staleClosure = Date.now() - WALLET_AUTOLOCK_TIME - 1;
    await browser.storage.local.set({ last_page_closure_timestamp: staleClosure });
    const closuresSeenByCheck: unknown[] = [];
    onFirstPage.mockImplementation(async () => {
      closuresSeenByCheck.push(await getClosureTimestamp());
    });

    const popup = buildPort(browser.runtime.getURL('popup.html'));
    const confirm = buildPort(browser.runtime.getURL('confirm.html'));
    connect(popup.port);
    connect(confirm.port);
    await flushPromises();

    expect(onFirstPage).toHaveBeenCalledTimes(1);
    expect(closuresSeenByCheck).toEqual([staleClosure]);
    expect(await getClosureTimestamp()).toBeUndefined();

    popup.disconnect();
    confirm.disconnect();
  });

  it('keeps a closure recorded while the first-page check was running', async () => {
    let finishCheck = () => {};
    onFirstPage.mockReturnValue(new Promise<void>(resolve => (finishCheck = resolve)));

    const popup = buildPort(browser.runtime.getURL('popup.html'));
    connect(popup.port);
    popup.disconnect();
    await flushPromises();
    const recordedClosure = await getClosureTimestamp();
    expect(typeof recordedClosure).toBe('number');

    finishCheck();
    await flushPromises();
    expect(await getClosureTimestamp()).toBe(recordedClosure);
  });

  it('schedules the deadline from a given closure while no page is open', () => {
    scheduleAutolockDeadline(Date.now() - WALLET_AUTOLOCK_TIME + 5_000);

    jest.advanceTimersByTime(5_000);
    expect(onDeadline).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);
    expect(onDeadline).toHaveBeenCalledTimes(1);
  });

  it('does not schedule the deadline while a page is open', () => {
    const popup = buildPort(browser.runtime.getURL('popup.html'));
    connect(popup.port);

    scheduleAutolockDeadline(Date.now() - WALLET_AUTOLOCK_TIME);
    jest.advanceTimersByTime(WALLET_AUTOLOCK_TIME * 2);
    expect(onDeadline).not.toHaveBeenCalled();

    popup.disconnect();
  });

  it('ignores content-script relay and non-intercom ports', async () => {
    const relayPort = {
      name: 'INTERCOM',
      sender: { id: browser.runtime.id, url: 'https://dapp.example', tab: { id: 1 } },
      onDisconnect: { addListener: jest.fn() }
    } as unknown as Runtime.Port;
    connect(relayPort);
    connect(buildPort(browser.runtime.getURL('popup.html'), 'OTHER').port);

    expect(hasOpenExtensionPages()).toBe(false);
    expect(relayPort.onDisconnect.addListener).not.toHaveBeenCalled();
  });
});
