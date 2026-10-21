import React from 'react';

import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';

import { buildRwaImagesStack, buildTokenImagesStack } from 'lib/images-uri';

import { ImageStacked } from './ImageStacked';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const thumbnailUri = 'https://assets.test/mars/thumb.jpeg';
const metadata = { address: 'KT1rwa', id: '0', name: 'Mars', symbol: 'MARS', decimals: 6, thumbnailUri };

it('uses the API thumbnail directly for RWA list and detail images', () => {
  expect(buildRwaImagesStack(metadata)[0]).toBe(thumbnailUri);
  expect(buildRwaImagesStack(metadata, true)[0]).toBe(thumbnailUri);
  expect(buildRwaImagesStack(metadata).slice(1)).toEqual(buildTokenImagesStack(thumbnailUri));
});

it.each(['RWA', 'regular token'])('preserves %s images and failed fallbacks across equivalent source arrays', kind => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const sources = kind === 'RWA' ? buildRwaImagesStack(metadata) : buildTokenImagesStack(thumbnailUri);
  const render = (urls: string[]) =>
    act(() =>
      root.render(<ImageStacked sources={urls} loader={<span>loading</span>} fallback={<span>failed</span>} />)
    );

  try {
    render(sources);
    const image = container.querySelector('img')!;
    act(() => Simulate.load(image));
    render([...sources]);
    expect(container.querySelector('img')).toBe(image);
    expect(container.textContent).toBe('');
    expect(image.getAttribute('src')).toBe(sources[0]);

    act(() => Simulate.error(image));
    expect(image.getAttribute('src')).toBe(sources[1]);
    act(() => Simulate.load(image));
    render([...sources]);
    expect(container.querySelector('img')).toBe(image);
    expect(image.getAttribute('src')).toBe(sources[1]);
    expect(container.textContent).toBe('');

    for (let index = 1; index < sources.length; index++) act(() => Simulate.error(image));
    expect(container.textContent).toBe('failed');
    render([...sources]);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('failed');

    render(['https://assets.test/updated.jpeg']);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://assets.test/updated.jpeg');
    expect(container.textContent).toBe('loading');
    act(() => Simulate.load(container.querySelector('img')!));
    expect(container.textContent).toBe('');
  } finally {
    act(() => root.unmount());
  }
});
