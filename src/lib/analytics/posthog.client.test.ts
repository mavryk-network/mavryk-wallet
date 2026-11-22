export {};

const loadClient = (env: Record<string, string | undefined>) => {
  const original = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'production' }, env);
  let client: typeof import('./posthog.client') | undefined;
  jest.isolateModules(() => {
    client = require('./posthog.client');
  });
  process.env = original;

  return client!;
};

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
  (global as { fetch?: unknown }).fetch = fetchMock;
});

it('does nothing without a project key or in unit tests', async () => {
  const client = loadClient({ POSTHOG_KEY: '' });

  expect(client.isPostHogConfigured()).toBe(false);
  expect(loadClient({ POSTHOG_KEY: 'phc_test', NODE_ENV: 'test' }).isPostHogConfigured()).toBe(false);
  await client.capturePostHogEvent({ event: 'wallet_unlocked', distinctId: 'id', properties: {} });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('posts an anonymous event to the EU capture endpoint by default', async () => {
  const client = loadClient({ POSTHOG_KEY: 'phc_test', POSTHOG_HOST: '' });

  await client.capturePostHogEvent({
    event: 'wallet_unlocked',
    distinctId: 'anon',
    properties: { network: 'mainnet' }
  });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://eu.i.posthog.com/i/v0/e/');
  expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
  expect(JSON.parse(init.body)).toMatchObject({
    api_key: 'phc_test',
    event: 'wallet_unlocked',
    distinct_id: 'anon',
    properties: { network: 'mainnet', distinct_id: 'anon', $process_person_profile: false }
  });
});

it('rejects on a non-OK response so callers can drop the event', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
  const client = loadClient({ POSTHOG_KEY: 'phc_test', POSTHOG_HOST: 'https://ph.example.com/' });

  await expect(client.capturePostHogEvent({ event: 'e', distinctId: 'id', properties: {} })).rejects.toThrow('401');
  expect(fetchMock.mock.calls[0][0]).toBe('https://ph.example.com/i/v0/e/');
});
