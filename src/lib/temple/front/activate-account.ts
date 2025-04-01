import type { Operation, MavrykToolkit } from '@mavrykdynamics/taquito';

type ActivationResult =
  | {
      status: 'ALREADY_ACTIVATED';
    }
  | {
      status: 'SENT';
      operation: Operation;
    };

export const activateAccount = (address: string, secret: string, tezos: MavrykToolkit): Promise<ActivationResult> =>
  tezos.tz.activate(address, secret).then(
    operation => ({ status: 'SENT', operation }),
    err => {
      const invalidActivationError = err && err.body && /Invalid activation/.test(err.body);
      if (invalidActivationError) {
        return { status: 'ALREADY_ACTIVATED' };
      }

      throw err;
    }
  );
