import React, { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { FeeValueParams, STAKE_MODE, useMavStakeFeeValue } from 'app/hooks/useFeeValue/use-fee-value';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { useAssetMetadata } from 'lib/metadata';
import { useAccount, useTezos } from 'lib/temple/front';
import { useAccountDelegatePeriodStats } from 'lib/temple/front/baking';
import { useTokenAmount } from 'app/pages/Stake/hooks/use-token-amount';
import { getMaxStakeAmount } from 'lib/utils/amounts';
import { ZERO } from 'lib/utils/numbers';

import { StakeAmountForm } from '../components/StakeAmountForm';

export const IncreaseStake = () => {
  const account = useAccount();
  const { data } = useAccountDelegatePeriodStats(account.publicKeyHash);
  const { stakedBalance = 0 } = data ?? {};
  const { value: balanceData = ZERO } = useBalance(MAV_TOKEN_SLUG, account.publicKeyHash);
  const balance = balanceData!;
  const assetMetadata = useAssetMetadata(MAV_TOKEN_SLUG);
  const tezos = useTezos();

  const amountValue = '0'; // Initial value for fee estimation; the form manages its own state
  const mavFeeProps: FeeValueParams = useMemo(
    () => ({ balance, acc: account, tezos, mode: STAKE_MODE, amount: new BigNumber(amountValue) }),
    [account, balance, tezos]
  );
  const { estimation, baseFee, safeFeeValue, feeError, estimationError } = useMavStakeFeeValue(mavFeeProps);

  const safeFeeBN = useMemo(() => new BigNumber(safeFeeValue), [safeFeeValue]);
  const totalFeeBN = useMemo(
    () => (baseFee instanceof BigNumber ? baseFee.plus(safeFeeBN) : undefined),
    [baseFee, safeFeeBN]
  );

  const maxAmount = useMemo(() => {
    if (!totalFeeBN) return undefined;
    return getMaxStakeAmount(balance, totalFeeBN, assetMetadata?.decimals ?? 6);
  }, [balance, totalFeeBN, assetMetadata?.decimals]);

  const stakedAmountDisplay = useTokenAmount(stakedBalance, assetMetadata);

  const externalError = useMemo(() => {
    const error = feeError ?? estimationError;
    return error ?? null;
  }, [feeError, estimationError]);

  return (
    <StakeAmountForm
      mode="increase"
      maxAmount={maxAmount}
      externalError={externalError}
      stakedAmountDisplay={stakedAmountDisplay}
      estimation={estimation}
    />
  );
};
