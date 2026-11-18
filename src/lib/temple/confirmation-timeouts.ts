export const IN_WALLET_CONFIRMATION_AUTODECLINE_MS = 60_000;
export const DAPP_CONFIRMATION_AUTODECLINE_MS = 120_000;
export const CONFIRMATION_REQUEST_TIMEOUT_GRACE_MS = 5_000;
export const LEDGER_CONFIRMATION_REQUEST_TIMEOUT_MS = 180_000;
/** Chain ids are looked up inside the shared dApp queue, so an RPC that never answers must not stall it */
export const DAPP_RPC_CHAIN_ID_TIMEOUT_MS = 10_000;
