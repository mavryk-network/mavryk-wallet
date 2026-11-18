import { Signer } from '@mavrykdynamics/webmavryk';

/** Wraps a signer so every payload passes `beforeSign` before it is signed. */
export function withBeforeSign(signer: Signer, beforeSign: (opBytes: string) => Promise<void>): Signer {
  return {
    sign: async (op, magicByte) => {
      await beforeSign(op);
      return signer.sign(op, magicByte);
    },
    publicKey: () => signer.publicKey(),
    publicKeyHash: () => signer.publicKeyHash(),
    secretKey: () => signer.secretKey()
  };
}
