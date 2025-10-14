import React, { FocusEventHandler, useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { Controller, useForm } from 'react-hook-form';

import { FormSubmitButton } from 'app/atoms';
import AssetField from 'app/atoms/AssetField';
import { MaxButton } from 'app/atoms/MaxButton';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { InfoTooltip } from 'app/molecules/InfoTooltip';
import { useBakingHistory } from 'app/pages/Stake/hooks/use-baking-history';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import OperationStatus from 'app/templates/OperationStatus';
import { useFormAnalytics } from 'lib/analytics';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { RECOMMENDED_ADD_FEE } from 'lib/constants';
import { T, t, toLocalFixed } from 'lib/i18n';
import { MAVEN_METADATA, useAssetMetadata } from 'lib/metadata';
import { useAccount, useTezos } from 'lib/temple/front';
import { useAccountDelegatePeriodStats } from 'lib/temple/front/baking';
import { atomsToTokens } from 'lib/temple/helpers';
import { TempleAccountType } from 'lib/temple/types';
import { useSafeState } from 'lib/ui/hooks';
import { delay } from 'lib/utils';
import { getMaxAmountToken } from 'lib/utils/amounts';
import { ZERO } from 'lib/utils/numbers';
import { navigate } from 'lib/woozie';

import {
  ManageStakeUnderTextFieldBalance,
  ManagStakeBalancetype
} from '../components/ManageStakeUnderTextFieldBalance';

interface FormData {
  amount: string;
}

export const IncreaseStake = () => {
  const { unfamiliarWithDelegation } = useBakingHistory();
  const account = useAccount();
  const { myBakerPkh, canCostake, stakedBalance } = useAccountDelegatePeriodStats(account.publicKeyHash);

  const amountFieldRef = React.useRef<HTMLInputElement>(null);
  const { value: balanceData = ZERO } = useBalance(MAV_TOKEN_SLUG, account.publicKeyHash);
  const balance = balanceData!;
  const assetMetadata = useAssetMetadata(MAV_TOKEN_SLUG);
  const tezos = useTezos();

  const formAnalytics = useFormAnalytics('CoStakeForm');

  useEffect(() => {
    if (!canCostake) {
      navigate('stake');
    }
  });

  const { watch, handleSubmit, errors, control, formState, setValue, triggerValidation } = useForm<FormData>({
    mode: 'onChange'
  });
  const [submitError, setSubmitError] = useSafeState<any>(null);
  const [operation, setOperation] = useSafeState<any>(null, tezos.checksum);

  useEffect(() => {
    if (account.type === TempleAccountType.WatchOnly) {
      navigate('/');
    } else if (unfamiliarWithDelegation) {
      navigate('stake');
    }
  }, [unfamiliarWithDelegation, account.publicKeyHash, account.type]);

  useEffect(() => {
    if (operation && (!operation._operationResult.hasError || !operation._operationResult.isStopped)) {
      navigate<SuccessStateType>('/success', undefined, {
        pageTitle: 'coStake',
        description: 'coStakeDesriptionSuccessMsg',
        btnText: 'goToMain',
        subHeader: 'coStakeSubHeaderSuccessMsg'
      });
    }
  }, [operation]);

  const amountValue = watch('amount');
  const baseFee = useMemo(() => new BigNumber(RECOMMENDED_ADD_FEE), []);

  const maxAmount = useMemo(
    () => getMaxAmountToken(account, balance, baseFee, RECOMMENDED_ADD_FEE),
    [account, balance, baseFee]
  );

  const stakedAmount = useMemo(
    () => atomsToTokens(stakedBalance, assetMetadata?.decimals ?? MAVEN_METADATA.decimals),
    [stakedBalance, assetMetadata?.decimals]
  );

  const validateAmount = useCallback(
    (v?: number) => {
      if (v === undefined) return t('required');

      if (!maxAmount) return true;
      const vBN = new BigNumber(v);
      return vBN.isLessThanOrEqualTo(maxAmount) || t('maximalAmount', toLocalFixed(maxAmount));
    },
    [maxAmount]
  );

  const handleSetMaxAmount = useCallback(() => {
    if (maxAmount) {
      setValue('amount', maxAmount.toString());
      triggerValidation('amount');
    }
  }, [setValue, maxAmount, triggerValidation]);

  const handleAmountFieldFocus = useCallback<FocusEventHandler>(evt => {
    evt.preventDefault();
    amountFieldRef.current?.focus({ preventScroll: true });
  }, []);

  const onSubmit = useCallback(
    async ({ amount }: FormData) => {
      if (formState.isSubmitting || !myBakerPkh) return;
      formAnalytics.trackSubmit({ amount });
      try {
        if (!assetMetadata) throw new Error('Metadata not found');

        const op = await tezos.wallet
          .stake({
            amount: Number(amount)
          })
          .send();

        setOperation(op);
        formAnalytics.trackSubmitSuccess({
          amount
        });
      } catch (err: any) {
        formAnalytics.trackSubmitFail({ amount });

        console.error(err);

        // Human delay.
        await delay();
        setSubmitError(err);
      }
    },
    [assetMetadata, formAnalytics, formState.isSubmitting, myBakerPkh, setOperation, setSubmitError, tezos.wallet]
  );

  const balancesData: ManagStakeBalancetype[] = useMemo(() => {
    return [
      {
        id: 1,
        balance: stakedAmount,
        i18nkey: 'stakedAmount',
        assetMetadata
      },
      {
        id: 2,
        balance,
        i18nkey: 'delegatedAmount',
        assetMetadata
      }
    ];
  }, [assetMetadata, balance, stakedAmount]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
      <Controller
        name="amount"
        as={<AssetField ref={amountFieldRef} onFocus={handleAmountFieldFocus} />}
        control={control}
        rules={{
          validate: validateAmount
        }}
        onChange={([v]) => v}
        onFocus={() => amountFieldRef.current?.focus()}
        id="co-stake-amount"
        assetDecimals={assetMetadata?.decimals ?? 0}
        label={
          <div className="flex items-center gap-1">
            <T id="increaseCostake" />
            <InfoTooltip content={<T id="increaseCostakeDesc" />} />
          </div>
        }
        placeholder={'Enter amount'}
        errorCaption={errors.amount?.message || submitError?.message}
        containerClassName="mb-1"
        autoFocus={Boolean(maxAmount)}
        extraInnerWrapper="unset"
        extraInner={
          <div className="absolute flex items-center justify-end inset-y-0 right-4 w-32">
            <MaxButton type="button" onClick={handleSetMaxAmount} fill={false} className="relative z-10" />
          </div>
        }
      />
      <div className="flex flex-col gap-1 flex-1">
        {balancesData.map(({ id, ...rest }) => (
          <ManageStakeUnderTextFieldBalance key={id} {...rest} />
        ))}
      </div>
      {operation && <OperationStatus typeTitle={'Co-staking'} operation={operation} className="mb-8 px-4" />}
      <div className="grid grid-cols-2 gap-3 w-full mt-6">
        <ButtonRounded size="big" fill={false} onClick={() => navigate('/stake')}>
          <T id="cancel" />
        </ButtonRounded>
        <FormSubmitButton
          loading={formState.isSubmitting}
          disabled={Boolean(
            formState.isSubmitting || errors.amount || !formState.isValid || !amountValue || amountValue === '0'
          )}
        >
          <T id="increase" />
        </FormSubmitButton>
      </div>
    </form>
  );
};
