import { Signer } from '@mavrykdynamics/webmavryk';

import { PublicError } from '../PublicError';

import { withBeforeSign } from './with-before-sign';

const OP_BYTES = 'deadbeef';
const MAGIC_BYTE = new Uint8Array([3]);
const SIGNATURE = { bytes: OP_BYTES, sig: 'sig', prefixSig: 'edsig', sbytes: `${OP_BYTES}00` };

const createSigner = (calls: string[] = []): jest.Mocked<Signer> => ({
  sign: jest.fn(async (_op: string, _magicByte?: Uint8Array) => {
    calls.push('sign');
    return SIGNATURE;
  }),
  publicKey: jest.fn(async () => 'edpk'),
  publicKeyHash: jest.fn(async () => 'mv1Test'),
  secretKey: jest.fn(async () => 'edsk')
});

describe('withBeforeSign', () => {
  it('never signs and passes the same PublicError through when beforeSign rejects', async () => {
    const signer = createSigner();
    const refusal = new PublicError('Signing was refused.');

    await expect(withBeforeSign(signer, () => Promise.reject(refusal)).sign(OP_BYTES, MAGIC_BYTE)).rejects.toBe(
      refusal
    );
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('runs beforeSign on the operation bytes, then signs the same bytes and magic byte', async () => {
    const calls: string[] = [];
    const signer = createSigner(calls);
    const beforeSign = jest.fn(async (_opBytes: string) => {
      calls.push('beforeSign');
    });

    await expect(withBeforeSign(signer, beforeSign).sign(OP_BYTES, MAGIC_BYTE)).resolves.toBe(SIGNATURE);
    expect(beforeSign).toHaveBeenCalledWith(OP_BYTES);
    expect(signer.sign).toHaveBeenCalledWith(OP_BYTES, MAGIC_BYTE);
    expect(calls).toEqual(['beforeSign', 'sign']);
  });

  it('forwards the key getters to the wrapped signer', async () => {
    const signer = createSigner();
    const wrapped = withBeforeSign(signer, () => Promise.resolve());

    await expect(wrapped.publicKey()).resolves.toBe('edpk');
    await expect(wrapped.publicKeyHash()).resolves.toBe('mv1Test');
    await expect(wrapped.secretKey()).resolves.toBe('edsk');
  });
});
