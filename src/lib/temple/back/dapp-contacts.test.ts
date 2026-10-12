import { DAppContactsMessageType, isDAppContactsRequest } from './dapp-contacts';

jest.mock('mavryk/api', () => ({
  CurrentContactsRecordDecryptionError: class CurrentContactsRecordDecryptionError extends Error {},
  fetchContactsRecord: jest.fn(),
  getAuthTokensFromStorage: jest.fn(),
  saveContactsRecord: jest.fn()
}));

describe('isDAppContactsRequest', () => {
  it.each([
    DAppContactsMessageType.CapabilityRequest,
    DAppContactsMessageType.GetRequest,
    DAppContactsMessageType.UpsertRequest,
    DAppContactsMessageType.DeleteRequest,
    DAppContactsMessageType.ReplaceRequest
  ])('accepts contacts bridge request type %s', type => {
    expect(isDAppContactsRequest({ type })).toBe(true);
  });

  it.each([null, undefined, 'CONTACTS_GET_REQUEST', { type: 'GET_CURRENT_PERMISSION_REQUEST' }])(
    'rejects non-contacts request %p',
    request => {
      expect(isDAppContactsRequest(request)).toBe(false);
    }
  );
});
