import { mavrykApi } from './client';
import { fetchRecentOperations, parseRecentOperationsResponse } from './recent-operations';

jest.mock('./client', () => ({ mavrykApi: { get: jest.fn() } }));

const CONTACT = 'mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G';
const CALLER_CONTEXT = { walletAddress: 'mv1-book-owner', networkId: 'basenet' };

const group = (hash: string) => ({
  type: 'transfer',
  hash,
  status: 'applied',
  details: { type: 'transfer', transferType: 'received', to: CONTACT, amount: 1.25, currency: 'MVRK' }
});

describe('fetchRecentOperations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests the contact path with the caller auth context and no query parameters', async () => {
    (mavrykApi.get as jest.Mock).mockResolvedValue({
      status: 200,
      headers: {},
      data: { walletAddress: CONTACT, operations: [group('a')], status: 'ready', updatedAt: '2026-11-02T10:00:00Z' }
    });

    const result = await fetchRecentOperations(CONTACT, CALLER_CONTEXT);

    const [path, config] = (mavrykApi.get as jest.Mock).mock.calls[0];
    expect(path).toBe(`/addresses/${CONTACT}/recent-operations`);
    expect(config._authContext).toEqual(CALLER_CONTEXT);
    expect(config.params).toBeUndefined();
    expect(config.validateStatus(202)).toBe(true);
    expect(config.validateStatus(204)).toBe(false);
    expect(result).toMatchObject({ status: 'ready', updatedAt: '2026-11-02T10:00:00Z', retryAfterSeconds: undefined });
    expect(result.operations).toHaveLength(1);
  });

  it('treats 202 preparing as success and keeps the longer of header and body retry hints', async () => {
    (mavrykApi.get as jest.Mock).mockResolvedValue({
      status: 202,
      headers: { 'retry-after': '8' },
      data: { walletAddress: CONTACT, operations: [], status: 'preparing', retryAfterSeconds: 5 }
    });

    await expect(fetchRecentOperations(CONTACT, CALLER_CONTEXT)).resolves.toMatchObject({
      status: 'preparing',
      operations: [],
      retryAfterSeconds: 8
    });
  });

  it('keeps status, code and Retry-After on failures', async () => {
    (mavrykApi.get as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 503, headers: { 'retry-after': '30' }, data: { error: 'down', code: 'service_unavailable' } }
    });

    await expect(fetchRecentOperations(CONTACT, CALLER_CONTEXT)).rejects.toMatchObject({
      status: 503,
      code: 'service_unavailable',
      retryAfterSeconds: 30
    });
  });
});

describe('parseRecentOperationsResponse', () => {
  it('rejects a response for another address', () => {
    expect(() =>
      parseRecentOperationsResponse({ walletAddress: 'mv1-other', operations: [], status: 'ready' }, CONTACT)
    ).toThrow();
  });

  it('rejects more than three groups instead of truncating', () => {
    expect(() =>
      parseRecentOperationsResponse(
        { walletAddress: CONTACT, operations: ['a', 'b', 'c', 'd'].map(group), status: 'ready' },
        CONTACT
      )
    ).toThrow();
  });

  it('rejects an unknown preview status', () => {
    expect(() =>
      parseRecentOperationsResponse({ walletAddress: CONTACT, operations: [], status: 'done' }, CONTACT)
    ).toThrow();
  });
});
