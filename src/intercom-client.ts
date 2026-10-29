import { IntercomClient } from 'lib/intercom/client';
import { getTempleRequestTimeoutMs } from 'lib/temple/request-timeouts';
import { TempleRequest, TempleResponse } from 'lib/temple/types';

export const intercomClient = new IntercomClient();

let intercom: IntercomClient;
export function getIntercom() {
  if (!intercom) {
    intercom = new IntercomClient();
  }
  return intercom;
}

export async function makeIntercomRequest(req: TempleRequest) {
  const res = await intercomClient.request(req, { timeoutMs: getTempleRequestTimeoutMs(req.type) });
  assertResponse('type' in res);

  return res as TempleResponse;
}

export function assertResponse(condition: any): asserts condition {
  if (!condition) {
    throw new Error('Invalid response recieved');
  }
}
