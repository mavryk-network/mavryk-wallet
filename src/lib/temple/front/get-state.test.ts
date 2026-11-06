import { TempleMessageType, TempleState, TempleStatus } from 'lib/temple/types';

import { fetchTempleStateWithRetry, GET_STATE_REQUEST_MAX_ATTEMPTS } from './get-state';

const state: TempleState = {
  status: TempleStatus.Idle,
  accounts: [],
  networks: [],
  settings: null
};

describe('fetchTempleStateWithRetry', () => {
  it('retries a cold GetStateRequest once and returns state', async () => {
    const requester = jest
      .fn()
      .mockRejectedValueOnce(new Error('cold intercom start'))
      .mockResolvedValueOnce({ type: TempleMessageType.GetStateResponse, state });
    const promise = fetchTempleStateWithRetry(requester);

    await expect(promise).resolves.toBe(state);
    expect(requester).toHaveBeenCalledTimes(GET_STATE_REQUEST_MAX_ATTEMPTS);
    expect(requester).toHaveBeenNthCalledWith(1, { type: TempleMessageType.GetStateRequest });
    expect(requester).toHaveBeenNthCalledWith(2, { type: TempleMessageType.GetStateRequest });
  });

  it('stops after the bounded GetStateRequest retry attempts', async () => {
    const finalError = new Error('still cold');
    const requester = jest
      .fn()
      .mockRejectedValueOnce(new Error('cold intercom start'))
      .mockRejectedValueOnce(finalError);
    const promise = fetchTempleStateWithRetry(requester);

    await expect(promise).rejects.toBe(finalError);
    expect(requester).toHaveBeenCalledTimes(GET_STATE_REQUEST_MAX_ATTEMPTS);
  });
});
