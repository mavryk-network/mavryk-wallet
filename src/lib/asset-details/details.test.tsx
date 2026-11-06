import React from 'react';

import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { assetDetailsKeys } from 'lib/query-keys';

import { createDetailHooks } from './create-detail-hooks';
import { DetailCategory, DetailRecord, DetailScope } from './details.types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SCOPE: DetailScope = { account: 'a', chainId: 'chain-a', networkId: 'mainnet' };
type Detail = { name: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {
    for (let index = 0; index < 12; index++) {
      await Promise.resolve();
      jest.advanceTimersByTime(0);
    }
  });
}

describe.each<DetailCategory>(['collectibles', 'rwas'])('%s detail ownership', category => {
  const createHooks = () => createDetailHooks<Detail>({ category, interval: 300000, fetch, publish });
  let client: QueryClient;
  let root: Root;
  let container: HTMLDivElement;
  let fetch: jest.Mock<Promise<DetailRecord<Detail>>, [DetailScope, string[], AbortSignal?]>;
  let publish: jest.Mock;
  let hooks: ReturnType<typeof createHooks>;
  let consoleError: jest.SpyInstance;
  const batchKey = (scope = SCOPE) => assetDetailsKeys.batch(category, scope.account, scope.chainId, scope.networkId);
  const leafKey = (slug: string, scope = SCOPE) =>
    assetDetailsKeys.leaf(category, scope.account, scope.chainId, scope.networkId, slug);

  beforeEach(() => {
    jest.useFakeTimers();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });
    fetch = jest.fn().mockResolvedValue({});
    publish = jest.fn().mockResolvedValue(undefined);
    hooks = createDetailHooks({ category, interval: 300000, fetch, publish });
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => {
    act(() => root.unmount());
    await flush();
    client.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
    consoleError.mockRestore();
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  });

  function Driver({ slugs, scope = SCOPE, interval }: { slugs: string[]; scope?: DetailScope; interval?: number }) {
    hooks.useBatch(scope, slugs, interval);
    return null;
  }

  function Leaf({ slug, scope = SCOPE }: { slug: string; scope?: DetailScope }) {
    const detail = hooks.useDetail(scope, slug);
    return (
      <span data-slug={slug}>{detail === undefined ? 'unloaded' : detail === null ? 'missing' : detail.name}</span>
    );
  }

  function State({ scope = SCOPE }: { scope?: DetailScope }) {
    const isLoading = hooks.useIsLoading(scope);
    const error = hooks.useError(scope);
    const all = hooks.useAllDetails(scope);
    return <output>{JSON.stringify({ isLoading, hasError: Boolean(error), all })}</output>;
  }

  async function render(children: React.ReactNode) {
    act(() => root.render(<QueryClientProvider client={client}>{children}</QueryClientProvider>));
    await flush();
  }

  it('reacts to cache writes and never fetches from leaf mounts, focus, reconnect or invalidation', async () => {
    const accidentalFetch = jest.fn().mockResolvedValue({ name: 'bad' });
    client.setDefaultOptions({ queries: { queryFn: accidentalFetch } });
    await render(
      <>
        <Leaf slug="one" />
        <State />
      </>
    );
    expect(container.textContent).toContain('unloaded');
    act(() => {
      client.setQueryData(leafKey('one'), { name: 'first' });
    });
    await flush();
    expect(container.textContent).toContain('first');
    act(() => {
      client.setQueryData(leafKey('one'), null);
    });
    await flush();
    expect(container.textContent).toContain('missing');
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await client.invalidateQueries();
    });
    await render(
      <>
        <Leaf slug="one" />
        <Leaf slug="two" />
        <State />
      </>
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(accidentalFetch).not.toHaveBeenCalled();
  });

  it('observes prefix-scoped requests and isolates the other category', async () => {
    const other = category === 'collectibles' ? 'rwas' : 'collectibles';
    const response = deferred<string>();
    await render(<State />);
    let request!: Promise<string>;
    act(() => {
      request = client.fetchQuery({
        queryKey: assetDetailsKeys.batch(other, SCOPE.account, SCOPE.chainId, SCOPE.networkId),
        queryFn: () => response.promise
      });
    });
    await flush();
    expect(container.textContent).toContain('"isLoading":false');
    response.resolve('done');
    await request;
    const matching = deferred<string>();
    act(() => {
      request = client.fetchQuery({ queryKey: [...batchKey(), 'sub-batch'], queryFn: () => matching.promise });
    });
    await flush();
    expect(container.textContent).toContain('"isLoading":true');
    matching.resolve('done');
    await request;
    await flush();
    expect(container.textContent).toContain('"isLoading":false');
  });

  it('coalesces StrictMode effect replay without a duplicate request', async () => {
    const response = deferred<DetailRecord<Detail>>();
    fetch.mockReturnValue(response.promise);
    await render(
      <React.StrictMode>
        <Driver slugs={['one']} />
        <Leaf slug="one" />
      </React.StrictMode>
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    response.resolve({ one: { name: 'done' } });
    await flush();
    expect(container.textContent).toBe('done');
  });

  it('coalesces overlapping drivers/cards, preserves arrays and records confirmed misses', async () => {
    const response = deferred<DetailRecord<Detail>>();
    fetch.mockReturnValue(response.promise);
    const slugs = ['two', 'one', 'one'];
    await render(
      <>
        <Driver slugs={slugs} />
        <Driver slugs={['one']} />
        <Leaf slug="one" />
        <Leaf slug="two" />
        <State />
      </>
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toEqual(['one', 'two']);
    expect(slugs).toEqual(['two', 'one', 'one']);
    expect(container.textContent).toContain('"isLoading":true');
    response.resolve({ one: { name: 'loaded' } });
    await flush();
    expect(container.textContent).toContain('loaded');
    expect(container.textContent).toContain('missing');
    expect(container.textContent).toContain('"isLoading":false');
    expect(client.getQueryData(leafKey('two'))).toBeNull();
    expect(client.getQueryCache().find({ queryKey: batchKey(), exact: true })).toBeDefined();
  });

  it('keeps failures distinct from misses, settles loading and preserves data through refresh failures', async () => {
    fetch
      .mockRejectedValueOnce(new Error('transport'))
      .mockResolvedValueOnce({ one: { name: 'recovered' } })
      .mockRejectedValueOnce(new Error('refresh'))
      .mockResolvedValueOnce({ one: { name: 'new' } });
    await render(
      <>
        <Driver slugs={['one']} />
        <Leaf slug="one" />
        <State />
      </>
    );
    expect(container.textContent).toContain('unloaded');
    expect(container.textContent).toContain('"hasError":true');
    expect(container.textContent).toContain('"isLoading":false');
    expect(publish).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300000);
    });
    await flush();
    expect(container.textContent).toContain('recovered');
    act(() => {
      jest.advanceTimersByTime(300000);
    });
    await flush();
    expect(container.textContent).toContain('recovered');
    expect(container.textContent).toContain('"hasError":true');
    act(() => {
      jest.advanceTimersByTime(300000);
    });
    await flush();
    expect(container.textContent).toContain('new');
    expect(container.textContent).toContain('"hasError":false');
  });

  it('replaces a confirmed miss on the next successful refresh', async () => {
    fetch.mockResolvedValueOnce({}).mockResolvedValueOnce({ one: { name: 'found' } });
    await render(
      <>
        <Driver slugs={['one']} />
        <Leaf slug="one" />
      </>
    );
    expect(container.textContent).toBe('missing');
    act(() => {
      jest.advanceTimersByTime(300000);
    });
    await flush();
    expect(container.textContent).toBe('found');
  });

  it('refreshes changed sets under one stable key and does not lose in-flight additions/removals', async () => {
    const first = deferred<DetailRecord<Detail>>();
    fetch.mockReturnValueOnce(first.promise).mockResolvedValue({ two: { name: 'second' } });
    await render(
      <>
        <Driver slugs={['one']} />
        <Leaf slug="two" />
        <State />
      </>
    );
    await render(
      <>
        <Driver slugs={['two']} />
        <Leaf slug="two" />
        <State />
      </>
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    first.resolve({ one: { name: 'removed' } });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][1]).toEqual(['two']);
    expect(client.getQueryData(leafKey('one'))).toBeUndefined();
    expect(client.getQueryData(batchKey())).toEqual({ two: { name: 'second' } });
    await render(
      <>
        <Driver slugs={[]} />
        <State />
      </>
    );
    expect(client.getQueryData(batchKey())).toEqual({});
    act(() => {
      jest.advanceTimersByTime(600000);
    });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(['account', 'chainId', 'networkId'] as const)(
    'isolates %s switches and ignores late responses',
    async field => {
      const first = deferred<DetailRecord<Detail>>();
      const second = deferred<DetailRecord<Detail>>();
      fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const nextScope = { ...SCOPE, [field]: 'other' };
      await render(
        <>
          <Driver slugs={['one']} />
          <Leaf slug="one" />
          <State scope={nextScope} />
        </>
      );
      expect(container.textContent).toContain('"isLoading":false');
      await render(
        <>
          <Driver slugs={['one']} scope={nextScope} />
          <Leaf slug="one" scope={nextScope} />
          <State scope={nextScope} />
        </>
      );
      expect(container.textContent).toContain('"isLoading":true');
      first.resolve({ one: { name: 'old' } });
      await flush();
      expect(client.getQueryData(leafKey('one', nextScope))).toBeUndefined();
      expect(client.getQueryData(leafKey('one'))).toBeUndefined();
      expect(client.isFetching({ queryKey: batchKey() })).toBe(0);
      second.resolve({ one: { name: 'current' } });
      await flush();
      expect(container.textContent).toContain('current');
      expect(container.textContent).not.toContain('old');
    }
  );

  it('skips empty/incomplete scopes and cancels the last driver without publishing late data', async () => {
    await render(
      <>
        <Driver slugs={[]} />
        <Driver slugs={['one']} scope={{ ...SCOPE, chainId: '' }} />
        <Driver slugs={['one']} scope={{ ...SCOPE, account: '' }} />
      </>
    );
    expect(fetch).not.toHaveBeenCalled();
    const response = deferred<DetailRecord<Detail>>();
    fetch.mockReturnValue(response.promise);
    await render(
      <>
        <Driver slugs={['one']} />
        <State />
      </>
    );
    await render(<State />);
    expect(container.textContent).toContain('"isLoading":false');
    response.resolve({ one: { name: 'late' } });
    await flush();
    expect(publish).not.toHaveBeenCalled();
    expect(client.getQueryData(leafKey('one'))).toBeUndefined();
  });

  it('uses the shortest registered interval and stops after all drivers unmount', async () => {
    await render(
      <>
        <Driver slugs={['one']} />
        <Driver slugs={['one']} interval={60000} />
      </>
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    await render(<Driver slugs={['one']} />);
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    await flush();
    // The already scheduled short timer can fire once; subsequent cadence returns to five minutes.
    const count = fetch.mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(count);
    await render(null);
    act(() => {
      jest.advanceTimersByTime(600000);
    });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(count);
  });
});
