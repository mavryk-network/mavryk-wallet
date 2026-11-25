import React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';

import { successContentData } from './content';

jest.mock('app/atoms', () => ({ HashChip: ({ hash }: { hash: string }) => <span>{hash}</span> }));
jest.mock('app/templates/OpenInExplorerChip', () => ({
  OpenInExplorerChip: ({ hash }: { hash: string }) => <a href={`/operation/${hash}`}>Explorer</a>
}));
jest.mock('lib/i18n', () => ({
  t: (id: string) => id,
  T: ({ id, substitutions }: { id: string; substitutions?: string }) => <span>{`${id} ${substitutions ?? ''}`}</span>
}));
jest.mock('./successScreen.module.css', () => ({}));
jest.mock('./templates/DelegationOperations', () => ({ DelegationOperation: () => null }));
jest.mock('./templates/SendOperation', () => ({ SendOperation: () => null }));

it('renders the swap success key with the submitted operation hash and explorer link', () => {
  const markup = renderToStaticMarkup(successContentData.hash({ hash: 'test-operation', i18nKey: 'swap' }));
  expect(markup).toContain('requestSent swap');
  expect(markup).toContain('test-operation');
  expect(markup).toContain('href="/operation/test-operation"');
});
