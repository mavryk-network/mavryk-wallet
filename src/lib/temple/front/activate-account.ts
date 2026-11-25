import type { Operation, MavrykToolkit } from '@mavrykdynamics/webmavryk';

type ActivationResult =
  | {
      status: 'ALREADY_ACTIVATED';
    }
  | {
      status: 'SENT';
      operation: Operation;
    };

export const activateAccount = (address: string, secret: string, mavryk: MavrykToolkit): Promise<ActivationResult> =>
  mavryk.mv.activate(address, secret).then(
    operation => ({ status: 'SENT', operation }),
    err => {
      const invalidActivationError = err && err.body && /Invalid activation/.test(err.body);
      if (invalidActivationError) {
        return { status: 'ALREADY_ACTIVATED' };
      }

      throw err;
    }
  );
