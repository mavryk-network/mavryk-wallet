import { PublicError } from 'lib/temple/back/PublicError';

import { TransportType } from './transport/types';

export const LEDGER_DERIVATION_PATH_PREFIXES = ["44'/1969'", "44'/1729'"] as const;

export const LEDGER_DERIVATION_PATH_PREFIXES_WITH_M = LEDGER_DERIVATION_PATH_PREFIXES.map(prefix => `m/${prefix}`);

const hasLedgerDerivationPathPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

export const getMatchingLedgerDerivationPathPrefix = (path: string) =>
  LEDGER_DERIVATION_PATH_PREFIXES.find(prefix => hasLedgerDerivationPathPrefix(path, prefix));

export const isAllowedLedgerDerivationPath = (path: string) => Boolean(getMatchingLedgerDerivationPathPrefix(path));

export const isAllowedLedgerDerivationPathInput = (path: string) =>
  LEDGER_DERIVATION_PATH_PREFIXES_WITH_M.some(prefix => hasLedgerDerivationPathPrefix(path, prefix));

export const removeMFromDerivationPath = (dPath: string) => (dPath.startsWith('m/') ? dPath.substring(2) : dPath);

export const getLedgerTransportType = () => {
  if (isSupportedHID()) return TransportType.WEBHID;
  if (isSupportedWebAuthn()) return TransportType.WEBAUTHN;
  return TransportType.U2F;
};

const isSupportedHID = () => Boolean(navigator?.hid);

const isSupportedWebAuthn = () => Boolean(navigator?.credentials);

export const toLedgerError = (error: string | { message: string }) => {
  const message = typeof error === 'object' ? error.message : error;
  return new PublicError(`Ledger error. ${message}`);
};
