import { E2eMessageType } from 'lib/e2e/types';
import { clearAsyncStorages } from 'lib/temple/reset';

/**
 * Answers only E2E reset requests. Returning `undefined` for everything else matters: a returned
 * promise claims the message's response channel, which would block other `runtime.onMessage` listeners.
 */
export const handleE2eResetMessage = (msg: unknown, isE2eResetEnabled: boolean) => {
  if (!isE2eResetEnabled || (msg as { type?: unknown } | undefined)?.type !== E2eMessageType.ResetRequest) return;

  return clearAsyncStorages()
    .then(() => ({ type: E2eMessageType.ResetResponse }))
    .catch(error => {
      console.error(error);
      return undefined;
    });
};
