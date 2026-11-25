import { DerivationType } from '@mavrykdynamics/webmavryk-ledger-signer';

import { TransportType } from '../types';

import type { CreatorArguments, ForegroundResponse, ProxyMessage } from './types';

type Listener = (message: unknown) => Promise<ForegroundResponse | null> | void;

const mockListeners: Listener[] = [];

jest.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: {
    runtime: { onMessage: { addListener: (listener: Listener) => mockListeners.push(listener) } },
    extension: { getViews: () => [window], getBackgroundPage: () => null }
  }
}));

jest.mock('../helpers', () => ({
  getLedgerTransportType: () => 'webhid'
}));

jest.mock('../index', () => ({
  createLedgerSigner: jest.fn()
}));

const accountA: CreatorArguments = {
  derivationPath: "44'/1969'/0'/0'",
  derivationType: DerivationType.ED25519,
  publicKey: 'edpkA',
  publicKeyHash: 'mv1A'
};

const accountB: CreatorArguments = {
  derivationPath: "44'/1969'/1'/0'",
  derivationType: DerivationType.ED25519,
  publicKey: 'edpkB',
  publicKeyHash: 'mv1B'
};

const request = (instanceId: number, creatorArgs: CreatorArguments): ProxyMessage => ({
  type: 'LEDGER_PROXY_REQUEST',
  instanceId,
  creatorArgs,
  method: 'publicKeyHash'
});

describe('ledger proxy foreground kept signers', () => {
  let createLedgerSigner: jest.Mock;
  let dispatch: Listener;

  beforeEach(() => {
    jest.resetModules();
    mockListeners.length = 0;

    createLedgerSigner = require('../index').createLedgerSigner;
    require('./foreground');

    createLedgerSigner.mockImplementation(
      async (_transport: TransportType, _path: string, _type?: DerivationType, pk?: string, pkh?: string) => ({
        signer: {
          publicKey: async () => pk,
          publicKeyHash: async () => pkh,
          sign: jest.fn()
        },
        cleanup: jest.fn()
      })
    );

    const [listener] = mockListeners;
    if (!listener) throw new Error('Foreground did not register a message listener');
    dispatch = listener;
  });

  it('does not serve a request for another account from a signer kept under the same instance id', async () => {
    const first = await dispatch(request(1, accountA));
    const second = await dispatch(request(1, accountB));

    expect(first).toEqual({ type: 'success', value: 'mv1A' });
    expect(second).toEqual({ type: 'success', value: 'mv1B' });
    expect(createLedgerSigner).toHaveBeenCalledTimes(2);
    expect(createLedgerSigner).toHaveBeenLastCalledWith(
      TransportType.WEBHID,
      accountB.derivationPath,
      accountB.derivationType,
      accountB.publicKey,
      accountB.publicKeyHash
    );
  });

  it('does not serve another account from a signer that is still being created', async () => {
    const [first, second] = await Promise.all([dispatch(request(1, accountA)), dispatch(request(1, accountB))]);

    expect(first).toEqual({ type: 'success', value: 'mv1A' });
    expect(second).toEqual({ type: 'success', value: 'mv1B' });
    expect(createLedgerSigner).toHaveBeenCalledTimes(2);
  });

  it('reuses the kept signer for repeated requests for the same account', async () => {
    await dispatch(request(1, accountA));
    const second = await dispatch(request(1, { ...accountA }));

    expect(second).toEqual({ type: 'success', value: 'mv1A' });
    expect(createLedgerSigner).toHaveBeenCalledTimes(1);
  });
});
