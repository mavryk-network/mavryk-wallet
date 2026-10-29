export {
  DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS,
  IntercomClient,
  IntercomDisconnectedError,
  IntercomTimeoutError
} from './client';
export type { IntercomRequestOptions } from './client';
export {
  IntercomServer,
  IntercomPortKind,
  type IntercomPortInfo,
  classifyIntercomPort,
  isConfirmUiPortInfo,
  isExtensionUiPortInfo,
  isTrustedUiPortInfo
} from './server';
