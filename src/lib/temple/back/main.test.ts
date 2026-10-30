import type { Runtime } from 'webextension-polyfill';

import { IntercomPortKind, type IntercomPortInfo } from 'lib/intercom';
import { encryptMessage } from 'lib/temple/beacon';
import { TempleMessageType, type TempleRequest } from 'lib/temple/types';

import * as Actions from './actions';
import { intercom } from './defaults';
import { start } from './main';

jest.mock('./actions', () => ({
  init: jest.fn(),
  unlockFromSession: jest.fn(),
  isDAppEnabled: jest.fn(),
  getBeaconMessage: jest.fn(),
  processBeacon: jest.fn(),
  processDApp: jest.fn()
}));

jest.mock('./analytics', () => ({}));

jest.mock('./defaults', () => ({
  intercom: {
    onRequest: jest.fn(),
    broadcast: jest.fn()
  }
}));

jest.mock('./store', () => ({
  store: {
    map: () => ({ watch: jest.fn() }),
    watch: jest.fn(),
    getState: () => ({ accounts: [] })
  },
  toFront: jest.fn()
}));

jest.mock('lib/env', () => ({ BACKGROUND_IS_WORKER: false }));
jest.mock('lib/store/zustand/ui-owner', () => ({ startUIOwner: jest.fn() }));
jest.mock('lib/temple/helpers', () => ({ buildAuthWalletAddressesMap: jest.fn() }));
jest.mock('lib/temple/reset', () => ({ clearAsyncStorages: jest.fn() }));
jest.mock('lib/utils/url-track/url-track.utils', () => ({
  getTrackedCashbackServiceDomain: jest.fn(),
  getTrackedUrl: jest.fn()
}));
jest.mock('mavryk/api/storage', () => ({ setAuthWalletAddressesMapToStorage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('lib/temple/beacon', () => ({
  ...jest.requireActual('lib/temple/beacon'),
  encryptMessage: jest.fn().mockResolvedValue('encrypted-ack'),
  getSenderId: jest.fn().mockResolvedValue('sender-id')
}));

const mockedActions = Actions as jest.Mocked<typeof Actions>;
const mockedOnRequest = intercom.onRequest as jest.MockedFunction<typeof intercom.onRequest>;
const mockedEncryptMessage = encryptMessage as jest.MockedFunction<typeof encryptMessage>;

const DAPP_ORIGIN = 'https://dapp.example';

const relayPortInfo: IntercomPortInfo = {
  kind: IntercomPortKind.ContentScriptRelay,
  senderUrl: `${DAPP_ORIGIN}/page`,
  frameId: 0
};

const acknowledgeRequest = {
  type: TempleMessageType.Acknowledge,
  origin: DAPP_ORIGIN,
  payload: 'encrypted-payload',
  beacon: true,
  encrypted: true
} as TempleRequest;

type ProcessRequest = (req: TempleRequest, port: Runtime.Port, portInfo: IntercomPortInfo) => Promise<unknown>;

let processRequest: ProcessRequest;

beforeAll(async () => {
  await start();
  processRequest = mockedOnRequest.mock.calls[0][0] as ProcessRequest;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedActions.isDAppEnabled.mockResolvedValue(true);
  mockedActions.getBeaconMessage.mockResolvedValue({
    recipientPubKey: 'dapp-public-key',
    req: { id: 'beacon-request-id' } as any,
    payload: null
  });
});

describe('background Acknowledge handling', () => {
  it('does not acknowledge or decode Beacon messages when dApp interaction is disabled', async () => {
    mockedActions.isDAppEnabled.mockResolvedValue(false);

    await expect(processRequest(acknowledgeRequest, {} as Runtime.Port, relayPortInfo)).resolves.toBeUndefined();

    expect(mockedActions.getBeaconMessage).not.toHaveBeenCalled();
    expect(mockedEncryptMessage).not.toHaveBeenCalled();
  });

  it('does not acknowledge a Beacon message that cannot be decoded', async () => {
    mockedActions.getBeaconMessage.mockResolvedValue({
      recipientPubKey: 'dapp-public-key',
      req: null,
      payload: null
    });

    await expect(processRequest(acknowledgeRequest, {} as Runtime.Port, relayPortInfo)).resolves.toBeUndefined();

    expect(mockedEncryptMessage).not.toHaveBeenCalled();
  });

  it('acknowledges a decoded Beacon message when dApp interaction is enabled', async () => {
    await expect(processRequest(acknowledgeRequest, {} as Runtime.Port, relayPortInfo)).resolves.toEqual({
      type: TempleMessageType.Acknowledge,
      payload: 'encrypted-ack',
      encrypted: true
    });

    expect(mockedActions.getBeaconMessage).toHaveBeenCalledWith(DAPP_ORIGIN, 'encrypted-payload', true);
    expect(mockedEncryptMessage).toHaveBeenCalledWith(expect.any(String), 'dapp-public-key');
  });

  it('rejects relay requests whose origin is not the port sender origin', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      processRequest(
        { ...acknowledgeRequest, origin: 'https://nexus.mavryk.org' } as TempleRequest,
        {} as Runtime.Port,
        relayPortInfo
      )
    ).rejects.toThrow('Unauthorized intercom request source');

    expect(mockedActions.isDAppEnabled).not.toHaveBeenCalled();
    expect(mockedActions.getBeaconMessage).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
