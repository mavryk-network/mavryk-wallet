import { TempleNetworkType } from 'lib/temple/types';

export { estimateMaxFee } from 'app/hooks/useFeeValue/utils';
export type { TransferParamsInvariant } from 'app/hooks/useFeeValue/utils';

export const getAssetPriceByNetwork = (network: TempleNetworkType, assetPrice: number | null) =>
  network === 'main' && assetPrice !== null;

export const getEstimateFallBackDisplayed = (toFilled: boolean, baseFee: unknown, estimating: boolean) =>
  toFilled && !baseFee && estimating;

export const getRestFormDisplayed = (toFilled: boolean, baseFee: unknown, estimationError: unknown) =>
  Boolean(toFilled && (baseFee || estimationError));

export const getFilled = (toFilled: boolean, toFieldFocused: boolean) => (!toFilled ? toFieldFocused : false);
