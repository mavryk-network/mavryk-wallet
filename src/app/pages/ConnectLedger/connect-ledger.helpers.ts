import type { DerivationType } from '@mavrykdynamics/webmavryk-ledger-signer';
import { getPkhfromPk } from '@mavrykdynamics/webmavryk-utils';

import { DEFAULT_LEDGER_DERIVATION_PATH } from 'app/defaults';
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
