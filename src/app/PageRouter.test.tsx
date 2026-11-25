import React, { Suspense } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import * as Woozie from 'lib/woozie';

import { PageRouter } from './PageRouter';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('app/env', () => ({
  OpenInFullPage: () => <span>open in full page</span>,
  useAppEnv: () => ({ popup: false, fullPage: true })
}));
jest.mock('lib/temple/front', () => ({ useTempleClient: () => ({ ready: true, locked: false }) }));
jest.mock('lib/analytics', () => ({ usePageRouterAnalytics: jest.fn() }));
jest.mock('app/a11y/RootSuspenseFallback', () => () => <span>route loading</span>);
jest.mock('./WithDataLoading', () => ({
  WithDataLoading: ({ children }: React.PropsWithChildren) => <>{children}</>
}));
jest.mock('app/pages/Home/Home', () => () => <span>home</span>);
jest.mock('app/pages/Unlock/Unlock', () => () => <span>unlock</span>);
jest.mock('app/pages/Welcome/Welcome', () => () => <span>welcome</span>);
jest.mock('app/pages/Settings/Settings', () => ({ tabSlug }: { tabSlug?: string | null }) => (
  <span>settings {tabSlug}</span>
));

let container: HTMLDivElement;
let root: Root;

const renderAt = (hash: string) => {
  window.history.replaceState(null, '', `/fullpage.html${hash}`);
  act(() =>
    root.render(
      <Suspense fallback={<span>root suspended</span>}>
        <Woozie.Provider>
          <PageRouter />
        </Woozie.Provider>
      </Suspense>
    )
  );
};

beforeEach(() => {
  // Idle preloading is not under test here; fake timers keep it from loading the real page modules.
  jest.useFakeTimers();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  jest.useRealTimers();
});

it('renders the eager Home route on the first render', () => {
  renderAt('#/');

  expect(container.textContent).toBe('home');
});

it('renders a lazy route after its module loads, without suspending the app', async () => {
  renderAt('#/settings/general');
  expect(container.textContent).toBe('route loading');

  await act(async () => undefined);
  expect(container.textContent).toBe('settings general');

  act(() => root.unmount());
  root = createRoot(container);
  renderAt('#/settings/about');
  expect(container.textContent).toBe('settings about');
});
