import React, { Component, PropsWithChildren, Suspense } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { lazyPage, preloadLazyPagesOnIdle } from './lazy-page';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const Fallback = () => <span>loading</span>;
const Page = ({ label }: { label: string }) => <span>page {label}</span>;

class TestErrorBoundary extends Component<PropsWithChildren, { error: string | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    return this.state.error ? <span>error {this.state.error}</span> : this.props.children;
  }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  jest.restoreAllMocks();
});

it('renders the fallback, then the page once its module loads, without suspending', async () => {
  const load = deferred<typeof Page>();
  const LazyTestPage = lazyPage(() => load.promise, Fallback);

  act(() =>
    root.render(
      <Suspense fallback={<span>suspended</span>}>
        <LazyTestPage label="a" />
      </Suspense>
    )
  );
  expect(container.textContent).toBe('loading');

  await act(async () => load.resolve(Page));
  expect(container.textContent).toBe('page a');
});

it('renders a preloaded page synchronously on first render', async () => {
  const load = jest.fn(async () => Page);
  const LazyTestPage = lazyPage(load, Fallback);

  await LazyTestPage.preload();
  await LazyTestPage.preload();
  act(() => root.render(<LazyTestPage label="b" />));

  expect(container.textContent).toBe('page b');
  expect(load).toHaveBeenCalledTimes(1);
});

it('throws a failed load to the error boundary and retries it on the next mount', async () => {
  const load = jest.fn().mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValueOnce(Page);
  const LazyTestPage = lazyPage<{ label: string }>(load, Fallback);

  await act(async () =>
    root.render(
      <TestErrorBoundary>
        <LazyTestPage label="c" />
      </TestErrorBoundary>
    )
  );
  expect(container.textContent).toBe('error chunk failed');

  await act(async () =>
    root.render(
      <TestErrorBoundary key="retry">
        <LazyTestPage label="c" />
      </TestErrorBoundary>
    )
  );
  expect(container.textContent).toBe('page c');
  expect(load).toHaveBeenCalledTimes(2);
});

it('preloads pages one by one in order and stops after cancel', async () => {
  jest.useFakeTimers();
  try {
    const order: string[] = [];
    const first = deferred<void>();
    const pages = [
      {
        preload: jest.fn(() => {
          order.push('first');

          return first.promise;
        })
      },
      { preload: jest.fn(async () => void order.push('second')) },
      { preload: jest.fn(async () => void order.push('third')) }
    ];

    const cancel = preloadLazyPagesOnIdle(pages);
    expect(order).toEqual([]);

    jest.runOnlyPendingTimers();
    expect(order).toEqual(['first']);
    jest.runOnlyPendingTimers();
    expect(order).toEqual(['first']);

    await act(async () => first.resolve());
    jest.runOnlyPendingTimers();
    expect(order).toEqual(['first', 'second']);

    cancel();
    await act(async () => undefined);
    jest.runOnlyPendingTimers();
    expect(order).toEqual(['first', 'second']);
    expect(pages[2].preload).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
