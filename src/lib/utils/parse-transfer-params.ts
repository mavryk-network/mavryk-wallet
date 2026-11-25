import { OpKind, TransferParams, WalletParamsWithKind } from '@mavrykdynamics/webmavryk';

export const parseTransferParamsToParamsWithKind = (transferParams: TransferParams): WalletParamsWithKind => ({
  ...transferParams,
  kind: OpKind.TRANSACTION
});
