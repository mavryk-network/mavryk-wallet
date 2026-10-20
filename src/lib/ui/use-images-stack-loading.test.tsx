import React from 'react';

import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useImagesStackLoading } from './use-images-stack-loading';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('preserves loaded and failed images across equal snapshot sources, but reloads changed URLs', () => {
  const root = createRoot(document.createElement('div'));
  let state: ReturnType<typeof useImagesStackLoading>;
  function Consumer({ sources }: { sources: string[] }) {
    state = useImagesStackLoading(sources);
    return null;
  }
  const render = (sources: string[]) => act(() => root.render(<Consumer sources={sources} />));
  render(['primary', 'fallback']);
  act(() => state.onFail());
  expect(state!.src).toBe('fallback');
  act(() => state.onSuccess());
  render(['primary', 'fallback']);
  expect(state!.src).toBe('fallback');
  expect(state!.isLoading).toBe(false);

  act(() => state.onFail());
  expect(state!.isStackFailed).toBe(true);
  render(['primary', 'fallback']);
  expect(state!.isStackFailed).toBe(true);
  expect(state!.isLoading).toBe(false);

  render(['updated']);
  expect(state!.src).toBe('updated');
  expect(state!.isLoading).toBe(true);
  expect(state!.isStackFailed).toBe(false);
  act(() => state.onSuccess());
  render(['updated']);
  expect(state!.isLoading).toBe(false);

  render([]);
  expect(state!.src).toBeUndefined();
  expect(state!.isLoading).toBe(false);
  expect(state!.isStackFailed).toBe(true);
  act(() => root.unmount());
});
