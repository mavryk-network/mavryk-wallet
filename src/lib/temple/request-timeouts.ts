import { DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS } from 'lib/intercom';

import {
  CONFIRMATION_REQUEST_TIMEOUT_GRACE_MS,
  DAPP_CONFIRMATION_AUTODECLINE_MS,
  DAPP_RPC_CHAIN_ID_TIMEOUT_MS,
  IN_WALLET_CONFIRMATION_AUTODECLINE_MS,
  LEDGER_CONFIRMATION_REQUEST_TIMEOUT_MS
} from './confirmation-timeouts';
import { TempleMessageType } from './types';

export const IN_WALLET_CONFIRMATION_REQUEST_TIMEOUT_MS =
  IN_WALLET_CONFIRMATION_AUTODECLINE_MS + CONFIRMATION_REQUEST_TIMEOUT_GRACE_MS;
export const DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS =
  DAPP_CONFIRMATION_AUTODECLINE_MS + CONFIRMATION_REQUEST_TIMEOUT_GRACE_MS;

// The in-wallet decision request spans signing (incl. Ledger device review) and broadcast.
export const IN_WALLET_DECISION_REQUEST_TIMEOUT_MS = Math.max(
  IN_WALLET_CONFIRMATION_REQUEST_TIMEOUT_MS,
  LEDGER_CONFIRMATION_REQUEST_TIMEOUT_MS
);
// A decision taken just before the auto-decline deadline keeps running past it, so the request that opened the
// confirmation must outlive the deadline plus the full decision budget, or it reports failure for a broadcast op.
export const IN_WALLET_OPERATION_REQUEST_TIMEOUT_MS =
  IN_WALLET_CONFIRMATION_REQUEST_TIMEOUT_MS + IN_WALLET_DECISION_REQUEST_TIMEOUT_MS;
// A queued dApp request still waiting for its turn after this long is refused before its prompt opens.
export const DAPP_QUEUE_WAIT_BUDGET_MS = DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS;
// Before the prompt opens, resolveNetwork and assertSessionChainId may each wait for the dApp RPC's chain id.
export const DAPP_NETWORK_RESOLUTION_BUDGET_MS = 2 * DAPP_RPC_CHAIN_ID_TIMEOUT_MS;
// dApp: queue wait and network resolution before the prompt opens, then deadline + grace, plus the dApp decision
// request budget (DAppOps/Sign/PermConfirmationRequest), so an approval just before the deadline finishes in time.
export const DAPP_PAGE_REQUEST_TIMEOUT_MS =
  DAPP_QUEUE_WAIT_BUDGET_MS +
  DAPP_NETWORK_RESOLUTION_BUDGET_MS +
  DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS +
  DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS;

const REQUEST_TIMEOUTS: Partial<Record<TempleMessageType, number>> = {
  [TempleMessageType.OperationsRequest]: IN_WALLET_OPERATION_REQUEST_TIMEOUT_MS,
  [TempleMessageType.SignRequest]: IN_WALLET_OPERATION_REQUEST_TIMEOUT_MS,
  [TempleMessageType.ConfirmationRequest]: IN_WALLET_DECISION_REQUEST_TIMEOUT_MS,
  [TempleMessageType.PageRequest]: DAPP_PAGE_REQUEST_TIMEOUT_MS,
  [TempleMessageType.DAppPermConfirmationRequest]: DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS,
  [TempleMessageType.DAppOpsConfirmationRequest]: DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS,
  [TempleMessageType.DAppSignConfirmationRequest]: DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS,
  [TempleMessageType.CreateLedgerAccountRequest]: LEDGER_CONFIRMATION_REQUEST_TIMEOUT_MS,
  [TempleMessageType.GetLedgerTezosPkRequest]: LEDGER_CONFIRMATION_REQUEST_TIMEOUT_MS
};

export const getTempleRequestTimeoutMs = (type: TempleMessageType) =>
  REQUEST_TIMEOUTS[type] ?? DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS;
