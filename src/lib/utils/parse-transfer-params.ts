import { OpKind, TransferParams, WalletParamsWithKind } from '@mavrykdynamics/taquito';

export const parseTransferParamsToParamsWithKind = (transferParams: TransferParams): WalletParamsWithKind => ({
  ...transferParams,
  kind: OpKind.TRANSACTION
});
