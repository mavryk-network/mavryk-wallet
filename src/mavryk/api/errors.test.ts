import { MavrykApiError, toMavrykApiError, toSafeLogError } from './errors';

const SECRET_ACCESS_TOKEN = 'at-secret';

const buildAxiosError = (status: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    config: { headers: { Authorization: `Bearer ${SECRET_ACCESS_TOKEN}` } },
    request: {},
    response: { status, data: { message: 'forbidden' }, headers: {} },
    toJSON: () => ({})
  });

describe('toSafeLogError', () => {
  it('keeps only status and message of a MavrykApiError that wraps an AxiosError', () => {
    const apiError = toMavrykApiError(buildAxiosError(403));

    expect(apiError).toBeInstanceOf(MavrykApiError);
    // Precondition: the raw error exposes the bearer header through its cause, as DevTools would show it.
    expect((apiError as { cause?: { config?: { headers?: Record<string, string> } } }).cause?.config?.headers).toEqual({
      Authorization: `Bearer ${SECRET_ACCESS_TOKEN}`
    });

    const safe = toSafeLogError(apiError);

    expect(safe).toEqual({ status: 403, message: 'forbidden' });
    expect(JSON.stringify(safe)).not.toContain(SECRET_ACCESS_TOKEN);
  });

  it('omits the status of a MavrykApiError without a response', () => {
    expect(toSafeLogError(new MavrykApiError('Network Error'))).toEqual({ message: 'Network Error' });
  });

  it('keeps only status and message of a raw AxiosError', () => {
    const safe = toSafeLogError(buildAxiosError(500));

    expect(safe).toEqual({ status: 500, message: 'forbidden' });
    expect(JSON.stringify(safe)).not.toContain(SECRET_ACCESS_TOKEN);
  });
});
