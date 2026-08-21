import { DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS } from 'lib/intercom';

import { LEDGER_CONFIRMATION_REQUEST_TIMEOUT_MS } from './confirmation-timeouts';
import {
  DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS,
  getTempleRequestTimeoutMs,
  IN_WALLET_CONFIRMATION_REQUEST_TIMEOUT_MS
} from './request-timeouts';
import { TempleMessageType } from './types';

describe('getTempleRequestTimeoutMs', () => {
  it('extends in-wallet operation and sign request timeouts', () => {
    expect(getTempleRequestTimeoutMs(TempleMessageType.OperationsRequest)).toBe(
      IN_WALLET_CONFIRMATION_REQUEST_TIMEOUT_MS
    );
    expect(getTempleRequestTimeoutMs(TempleMessageType.SignRequest)).toBe(IN_WALLET_CONFIRMATION_REQUEST_TIMEOUT_MS);
  });

  it('extends dApp confirmation and page request timeouts', () => {
    expect(getTempleRequestTimeoutMs(TempleMessageType.PageRequest)).toBe(DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS);
    expect(getTempleRequestTimeoutMs(TempleMessageType.DAppPermConfirmationRequest)).toBe(
      DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS
    );
    expect(getTempleRequestTimeoutMs(TempleMessageType.DAppOpsConfirmationRequest)).toBe(
      DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS
    );
    expect(getTempleRequestTimeoutMs(TempleMessageType.DAppSignConfirmationRequest)).toBe(
      DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS
    );
  });

  it('extends Ledger account creation and public-key request timeouts', () => {
    expect(getTempleRequestTimeoutMs(TempleMessageType.CreateLedgerAccountRequest)).toBe(
      LEDGER_CONFIRMATION_REQUEST_TIMEOUT_MS
    );
    expect(getTempleRequestTimeoutMs(TempleMessageType.GetLedgerTezosPkRequest)).toBe(
      LEDGER_CONFIRMATION_REQUEST_TIMEOUT_MS
    );
  });

  it('keeps secret-bearing requests on the default timeout', () => {
    const secretBearingRequestTypes = [
      TempleMessageType.UnlockRequest,
      TempleMessageType.RevealPrivateKeyRequest,
      TempleMessageType.RevealMnemonicRequest,
      TempleMessageType.GenerateSyncPayloadRequest,
      TempleMessageType.ImportAccountRequest,
      TempleMessageType.ImportMnemonicAccountRequest,
      TempleMessageType.ImportFundraiserAccountRequest,
      TempleMessageType.CreateOrImportWalletRequest
    ];

    secretBearingRequestTypes.forEach(type => {
      expect(getTempleRequestTimeoutMs(type)).toBe(DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS);
    });
  });

  it('keeps non-allowlisted requests on the default timeout', () => {
    expect(getTempleRequestTimeoutMs(TempleMessageType.GetStateRequest)).toBe(DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS);
    expect(getTempleRequestTimeoutMs(TempleMessageType.EnsureAuthorizedRequest)).toBe(
      DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS
    );
  });
});
