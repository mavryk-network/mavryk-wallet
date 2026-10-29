import { TempleMessageType, TempleRequest, TempleResponse, TempleState } from 'lib/temple/types';

export const GET_STATE_REQUEST_MAX_ATTEMPTS = 2;
export const GET_STATE_REQUEST_RETRY_DELAY_MS = 250;

type TempleRequester = <T extends TempleRequest>(req: T) => Promise<TempleResponse>;

export async function fetchTempleStateWithRetry(requester: TempleRequester) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= GET_STATE_REQUEST_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await requester({ type: TempleMessageType.GetStateRequest });
      assertGetStateResponse(res);

      return res.state;
    } catch (error: any) {
      lastError = error;

      if (attempt === GET_STATE_REQUEST_MAX_ATTEMPTS) {
        throw error;
      }

      await delay(GET_STATE_REQUEST_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

function assertGetStateResponse(
  res: TempleResponse
): asserts res is Extract<TempleResponse, { type: TempleMessageType.GetStateResponse; state: TempleState }> {
  if (res.type !== TempleMessageType.GetStateResponse) {
    throw new Error('Invalid response recieved');
  }
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
