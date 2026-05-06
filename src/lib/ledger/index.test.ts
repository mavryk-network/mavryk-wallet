export {};

jest.mock('./signer', () => ({
  TempleLedgerSigner: jest.fn().mockImplementation(() => ({ kind: 'ledger-signer' }))
}));

jest.mock('./transport', () => {
  const TransportType = {
    U2F: 'u2f',
    WEBHID: 'webhid',
    WEBAUTHN: 'webauthn'
  };

  class MockTransport {
    updateTransportType = jest.fn();
    close = jest.fn();

    constructor(public transportType: string) {}
  }

  return {
    TransportType,
    TempleLedgerTransport: jest.fn().mockImplementation((transportType: string) => new MockTransport(transportType))
  };
});

const LEDGER_PATH = "m/44'/1969'/0'/0'";

describe('ledger transport manager', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('reuses a single transport instance across concurrent signer creation', async () => {
    const { createLedgerSigner } = await import('./index');
    const { TempleLedgerSigner } = await import('./signer');
    const { TempleLedgerTransport, TransportType } = await import('./transport');

    await Promise.all([
      createLedgerSigner(TransportType.WEBHID, LEDGER_PATH),
      createLedgerSigner(TransportType.WEBHID, LEDGER_PATH)
    ]);

    expect(TempleLedgerTransport).toHaveBeenCalledTimes(1);

    const firstSignerArgs = (TempleLedgerSigner as jest.Mock).mock.calls[0];
    const secondSignerArgs = (TempleLedgerSigner as jest.Mock).mock.calls[1];

    expect(firstSignerArgs[0]).toBe(secondSignerArgs[0]);
  });

  it('updates the shared transport instead of recreating it when the transport type changes', async () => {
    const { createLedgerSigner } = await import('./index');
    const { TempleLedgerTransport, TransportType } = await import('./transport');

    await createLedgerSigner(TransportType.WEBHID, LEDGER_PATH);
    await createLedgerSigner(TransportType.WEBAUTHN, LEDGER_PATH);

    expect(TempleLedgerTransport).toHaveBeenCalledTimes(1);

    const sharedTransport = (TempleLedgerTransport as unknown as jest.Mock).mock.results[0].value;
    expect(sharedTransport.updateTransportType).toHaveBeenCalledWith(TransportType.WEBAUTHN);
  });
});
