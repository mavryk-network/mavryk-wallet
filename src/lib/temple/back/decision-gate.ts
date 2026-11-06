/**
 * Serialises a confirmation prompt's decision. While a decision is being processed,
 * auto-decline (timeout, disconnect, window removal) is deferred, never applied mid-sign.
 */
export function createDecisionGate(declineAndClose: () => void) {
  let deciding = false;
  let declineDeferred = false;

  const declineOrDefer = () => {
    if (deciding) {
      declineDeferred = true;
      return;
    }

    declineAndClose();
  };

  const begin = () => {
    if (deciding) {
      throw new Error('Confirmation is already being processed');
    }
    deciding = true;
  };

  const release = () => {
    deciding = false;
    if (declineDeferred) {
      declineDeferred = false;
      declineOrDefer();
    }
  };

  /** A decline arrived during the decision; a step that has not signed yet should stop rather than sign */
  const isDeclineDeferred = () => declineDeferred;

  return { begin, release, declineOrDefer, isDeclineDeferred };
}
