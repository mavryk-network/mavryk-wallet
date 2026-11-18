import { E2eMessageType } from 'lib/e2e/types';

import { handleE2eResetMessage } from './e2e-reset-listener';

const mockClearAsyncStorages = jest.fn(() => Promise.resolve());

jest.mock('lib/temple/reset', () => ({ clearAsyncStorages: () => mockClearAsyncStorages() }));

describe('handleE2eResetMessage', () => {
  beforeEach(() => mockClearAsyncStorages.mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('leaves unrelated messages for other listeners to answer', () => {
    expect(handleE2eResetMessage({ type: 'SomethingElse' }, true)).toBeUndefined();
    expect(handleE2eResetMessage(undefined, true)).toBeUndefined();
    expect(mockClearAsyncStorages).not.toHaveBeenCalled();
  });

  it('ignores reset requests when E2E reset is disabled', () => {
    expect(handleE2eResetMessage({ type: E2eMessageType.ResetRequest }, false)).toBeUndefined();
    expect(mockClearAsyncStorages).not.toHaveBeenCalled();
  });

  it('clears storage and answers reset requests when enabled', async () => {
    await expect(handleE2eResetMessage({ type: E2eMessageType.ResetRequest }, true)).resolves.toEqual({
      type: E2eMessageType.ResetResponse
    });
    expect(mockClearAsyncStorages).toHaveBeenCalledTimes(1);
  });

  it('resolves to undefined when clearing storage fails', async () => {
    mockClearAsyncStorages.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(handleE2eResetMessage({ type: E2eMessageType.ResetRequest }, true)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
