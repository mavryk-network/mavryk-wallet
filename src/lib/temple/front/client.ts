import { IntercomClient } from 'lib/intercom';
import { startIntercomSync } from 'lib/store/zustand/intercom-sync';
import { TempleRequest, TempleResponse } from 'lib/temple/types';

export const intercom = new IntercomClient();

// Start intercom sync at module level so it runs before any React Suspense boundary.
// This avoids a deadlock where useWalletSuspense() suspends rendering, preventing the
// useEffect that would trigger the initial state fetch from ever firing.
startIntercomSync(intercom);

export async function request<T extends TempleRequest>(req: T) {
  const res = await intercom.request(req);
  assertResponse('type' in res);
  return res as TempleResponse;
}

export function assertResponse(condition: any): asserts condition {
  if (!condition) {
    throw new Error('Invalid response recieved');
  }
}
