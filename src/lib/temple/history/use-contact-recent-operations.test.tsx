import React from 'react';

import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { getContactsBookScope } from 'lib/temple/front/contacts-settings';
import { MavrykApiError } from 'mavryk/api/errors';
import { fetchRecentOperations } from 'mavryk/api/recent-operations';

import { useContactRecentOperations } from './use-contact-recent-operations';
import { usePurchaseMetadata } from './use-purchase-metadata';

const ACTIVE = 'mv1-active';
const BOOK_OWNER = 'mv1-book-owner';
const CONTACT = 'mv1-contact';
const OTHER_CONTACT = 'mv1-other-contact';

jest.mock('lib/temple/front', () => ({
  useAccount: () => ({ publicKeyHash: ACTIVE }),
  useAllAccounts: () => [],
  useNetwork: () => ({ id: 'basenet' })
}));
jest.mock('lib/temple/front/contacts-settings', () => ({ getContactsBookScope: jest.fn() }));
jest.mock('mavryk/api/recent-operations', () => ({ fetchRecentOperations: jest.fn() }));
jest.mock('./use-purchase-metadata', () => ({ usePurchaseMetadata: jest.fn(() => undefined) }));
jest.mock('./fetch', () => ({
  normalizeRecentOperationsItems: async (operations: { hash: string }[]) =>
    operations.map((operation, index) => ({ id: `${index}:${operation.hash}`, hash: operation.hash }))
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = fetchRecentOperations as jest.MockedFunction<typeof fetchRecentOperations>;
const bookScopeMock = getContactsBookScope as jest.MockedFunction<typeof getContactsBookScope>;

type HookResult = ReturnType<typeof useContactRecentOperations>;

let result: HookResult;
let root: Root;

function Probe({ address }: { address: string | undefined }) {
  result = useContactRecentOperations(address);
  return null;
}

const render = (address: string | undefined) =>
  act(async () => {
    root.render(<Probe address={address} />);
  });

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

const response = (overrides: Partial<Awaited<ReturnType<typeof fetchRecentOperations>>>) => ({
  walletAddress: CONTACT,
  operations: [],
  status: 'ready' as const,
  ...overrides
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  bookScopeMock.mockReturnValue({ status: 'available', bookAddr: BOOK_OWNER });
  root = createRoot(document.createElement('div'));
});

afterEach(async () => {
  await act(async () => root.unmount());
  jest.useRealTimers();
});

it('authenticates as the book owner, follows preparing hints, then stops polling on ready', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ status: 'preparing', retryAfterSeconds: 5 }))
    .mockResolvedValueOnce(response({ status: 'preparing', retryAfterSeconds: 5 }))
    .mockResolvedValueOnce(
      response({
        status: 'ready',
        updatedAt: '2026-11-02T10:00:00Z',
        operations: [{ hash: 'a' }, { hash: 'a' }, { hash: 'b' }] as never
      })
    );

  await render(CONTACT);
  expect(fetchMock).toHaveBeenLastCalledWith(CONTACT, { walletAddress: BOOK_OWNER, networkId: 'basenet' });
  expect(result.status).toBe('preparing');
  expect(result.items).toEqual([]);

  await advance(5000);
  expect(result.status).toBe('preparing');

  await advance(5000);
  expect(result.status).toBe('ready');
  expect(result.items.map(item => item.id)).toEqual(['0:a', '1:a', '2:b']);
  expect(result.updatedAt).toBe('2026-11-02T10:00:00Z');

  await advance(120_000);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('resolves token decimals in the active wallet scope, never the contact scope', async () => {
  // A contact-scoped metadata request is always cancelled by the selected-wallet scope guard,
  // which turned every contact card that needs decimals into a load error.
  fetchMock.mockResolvedValueOnce(response({ status: 'ready', operations: [{ hash: 'a' }] as never }));

  await render(CONTACT);

  expect(usePurchaseMetadata).toHaveBeenCalledWith();
  expect(result.status).toBe('ready');
});

it('does not request before the contact or the address book owner resolve', async () => {
  await render(undefined);
  expect(result.status).toBe('idle');

  bookScopeMock.mockReturnValue({ status: 'unavailable', reason: 'missing-account' });
  await render(CONTACT);
  expect(result.status).toBe('idle');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('shows contract contacts as unsupported without requesting', async () => {
  await render('KT1Contract');
  expect(result.status).toBe('unsupported');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('retries a rate-limited request once after Retry-After and blocks manual retry meanwhile', async () => {
  const rateLimited = new MavrykApiError('limited', { status: 429, code: 'rate_limited', retryAfterSeconds: 20 });
  fetchMock.mockRejectedValueOnce(rateLimited).mockRejectedValueOnce(rateLimited);

  await render(CONTACT);
  expect(result.status).toBe('error');
  expect(result.items).toEqual([]);

  await act(async () => result.retry());
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await advance(20_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.status).toBe('error');

  await advance(120_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('stops on an authentication failure instead of showing empty history', async () => {
  fetchMock.mockRejectedValueOnce(new MavrykApiError('unauthorized', { status: 401 }));

  await render(CONTACT);
  await advance(120_000);

  expect(result.status).toBe('error');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('ignores a late response after switching to another contact', async () => {
  let resolveFirst: (value: Awaited<ReturnType<typeof fetchRecentOperations>>) => void = () => undefined;
  fetchMock
    .mockReturnValueOnce(new Promise(resolve => (resolveFirst = resolve)))
    .mockResolvedValueOnce(response({ walletAddress: OTHER_CONTACT, status: 'ready', operations: [] }));

  await render(CONTACT);
  await render(OTHER_CONTACT);
  expect(result.status).toBe('ready');

  await act(async () => resolveFirst(response({ status: 'ready', operations: [{ hash: 'late' }] as never })));
  expect(result.items).toEqual([]);
});
