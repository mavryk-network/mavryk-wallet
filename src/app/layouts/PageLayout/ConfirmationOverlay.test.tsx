import React, { Suspense } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import ConfirmationOverlay from './ConfirmationOverlay';

type MockConfirmation = { id: string; payload: unknown; error?: unknown } | null;

let mockConfirmation: MockConfirmation = null;
let suspendedContent: Promise<void> | null = null;

jest.mock('app/env', () => ({ useAppEnv: () => ({ popup: false }) }));
jest.mock('app/layouts/pageLayout.module.css', () => ({ fullpageBg: 'fullpage-bg' }));
jest.mock('app/a11y/DocBg', () => ({ __esModule: true, default: () => null }));
jest.mock('app/atoms/Spinner/Spinner', () => ({ __esModule: true, default: () => <div data-spinner /> }));
jest.mock('lib/temple/front', () => ({
  useTempleClient: () => ({
    confirmation: mockConfirmation,
    resetConfirmation: jest.fn(),
    confirmInternal: jest.fn()
  })
}));
// Suspends like the real screen's SWR suspense fetch until `suspendedContent` settles
jest.mock('app/templates/InternalConfirmation', () => ({
  __esModule: true,
  default: () => {
    if (suspendedContent) throw suspendedContent;
    return <div data-confirmation />;
  }
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('ConfirmationOverlay', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = () =>
    act(() => {
      root.render(
        <Suspense fallback={<div data-outer-fallback />}>
          <ConfirmationOverlay />
        </Suspense>
      );
    });

  beforeEach(() => {
    jest.useFakeTimers();
    window.scrollTo = jest.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockConfirmation = null;
    suspendedContent = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  it('shows a confirmation whose content suspends on first open without an update loop', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render();

    let resolveContent!: () => void;
    suspendedContent = new Promise<void>(resolve => (resolveContent = resolve));
    mockConfirmation = { id: 'op-1', payload: { type: 'operations' } };
    render();

    expect(document.querySelector('[data-outer-fallback]')).toBeNull();
    expect(document.querySelector('[data-spinner]')).not.toBeNull();

    suspendedContent = null;
    await act(async () => {
      resolveContent();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(document.querySelector('[data-confirmation]')).not.toBeNull();
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/Maximum update depth/);
    consoleError.mockRestore();
  });
});
