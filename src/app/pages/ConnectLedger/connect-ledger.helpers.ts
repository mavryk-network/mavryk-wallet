import type { DerivationType } from '@mavrykdynamics/webmavryk-ledger-signer';
import { getPkhfromPk } from '@mavrykdynamics/webmavryk-utils';

import { DEFAULT_LEDGER_DERIVATION_PATH } from 'app/defaults';
import { getMessage } from 'lib/i18n';
import { isAllowedLedgerDerivationPathInput } from 'lib/ledger/helpers';
import { validateDerivationPath } from 'lib/temple/front/helpers';
import { SaveLedgerAccountInput, TempleChainKind } from 'lib/temple/types';

export type LedgerDerivationPathType = 'default' | 'custom';

interface BuildLedgerAccountPayloadParams {
  name: string;
  defaultName: string;
  publicKey: string;
  derivationPath: string;
  derivationType?: DerivationType;
}

export const resolveLedgerDerivationPath = (
  derivationPathType?: LedgerDerivationPathType,
  customDerivationPath?: string
) => (derivationPathType === 'custom' ? customDerivationPath ?? '' : DEFAULT_LEDGER_DERIVATION_PATH);

export const validateLedgerDerivationPath = (path: string) => {
  if (path.length === 0) return true;

  const baseValidationResult = validateDerivationPath(path);
  if (baseValidationResult !== true) {
    return baseValidationResult;
  }

  return isAllowedLedgerDerivationPathInput(path) ? true : getMessage('invalidPath');
};

export const buildLedgerAccountPayload = ({
  name,
  defaultName,
  publicKey,
  derivationPath,
  derivationType
}: BuildLedgerAccountPayloadParams): SaveLedgerAccountInput => ({
  name: name.trim() || defaultName,
  chain: TempleChainKind.Tezos,
  derivationPath,
  derivationType,
  publicKey,
  publicKeyHash: getPkhfromPk(publicKey),
  isKYC: undefined
});
