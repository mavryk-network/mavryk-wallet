import browser from 'webextension-polyfill';

import { DerivationType } from '@mavrykdynamics/webmavryk-ledger-signer';

jest.mock('../index', () => ({
  createLedgerSigner: jest.fn()
}));

import { createLedgerSigner } from '../index';
import { TransportType } from '../types';

import { TempleLedgerSignerProxy } from './signer';

const creatorArgs = {
  derivationPath: "44'/1969'/0'/0'",
  derivationType: DerivationType.ED25519,
  publicKey: 'edpk',
  publicKeyHash: 'mv1'
};

describe('TempleLedgerSignerProxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(browser.runtime, 'sendMessage', {
      value: jest.fn(),
      writable: true
    });
  });

  it('reuses one fallback signer for parallel method calls', async () => {
    const directSigner = {
      publicKey: jest.fn().mockResolvedValue('edpk'),
      publicKeyHash: jest.fn().mockResolvedValue('mv1'),
      sign: jest.fn(),
      secretKey: jest.fn()
    };

    (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
      type: 'refusal',
      transportType: TransportType.WEBHID
    });
    (createLedgerSigner as jest.Mock).mockResolvedValue({
      signer: directSigner,
      cleanup: jest.fn()
    });

    const signer = new TempleLedgerSignerProxy(creatorArgs);

    const [publicKey, publicKeyHash] = await Promise.all([signer.publicKey(), signer.publicKeyHash()]);

    expect(publicKey).toBe('edpk');
    expect(publicKeyHash).toBe('mv1');
    expect(createLedgerSigner).toHaveBeenCalledTimes(1);
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('releases the kept foreground signer on cleanup', async () => {
    (browser.runtime.sendMessage as jest.Mock)
      .mockResolvedValueOnce({ type: 'success', value: 'edpk' })
      .mockResolvedValueOnce(null);

    const signer = new TempleLedgerSignerProxy(creatorArgs);

    await signer.publicKey();
    await signer.cleanup();

    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'LEDGER_PROXY_RELEASE',
        instanceId: expect.any(Number)
      })
    );
  });
});
