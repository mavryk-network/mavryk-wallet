import React, { FC, FocusEventHandler, useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { Controller, useForm } from 'react-hook-form';

import { FormSubmitButton } from 'app/atoms';
import AssetField from 'app/atoms/AssetField';
import { MaxButton } from 'app/atoms/MaxButton';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { InfoTooltip } from 'app/molecules/InfoTooltip';
import { useBakingHistory } from 'app/pages/Stake/hooks/use-baking-history';
import { useTokenAmount } from 'app/pages/Stake/hooks/use-token-amount';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import OperationStatus from 'app/templates/OperationStatus';
import { useFormAnalytics } from 'lib/analytics';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { IS_DEV_ENV } from 'lib/env';
import { T, t, TID, toLocalFixed } from 'lib/i18n';
import { MAVEN_METADATA, useAssetMetadata } from 'lib/metadata';
import { useAccount, useChainId, useMavryk } from 'lib/temple/front';
import { useAccountDelegatePeriodStats } from 'lib/temple/front/baking';
import { tokensToAtoms } from 'lib/temple/helpers';
import { buildPendingOperationObject, putOperationIntoStorage } from 'lib/temple/history/utils';
import { TempleAccountType } from 'lib/temple/types';
import { useSafeState } from 'lib/ui/hooks';
import { delay } from 'lib/utils';
import { ZERO } from 'lib/utils/numbers';
import { goBack, navigate, useLocation } from 'lib/woozie';

import { ManageStakeUnderTextFieldBalance, ManagStakeBalancetype } from './ManageStakeUnderTextFieldBalance';

export type StakeMode = 'increase' | 'decrease';

interface FormData {
  amount: string;
}

interface StakeModeConfig {
  formAnalyticsName: string;
  labelI18nKey: TID;
  descI18nKey: TID;
  successPageTitle: TID;
  successType: string;
  operationStatusTitle: string;
  submitButtonI18nKey: TID;
  operationKind: string;
}

const MODE_CONFIG: Record<StakeMode, StakeModeConfig> = {
  increase: {
    formAnalyticsName: 'CoStakeForm',
    labelI18nKey: 'increaseCostake',
    descI18nKey: 'increaseCostakeDesc',
    successPageTitle: 'coStake',
    successType: 'stake',
    operationStatusTitle: 'Co-staking',
    submitButtonI18nKey: 'increase',
    operationKind: 'stake'
  },
  decrease: {
    formAnalyticsName: 'UnlockCoStakeForm',
    labelI18nKey: 'decreaseCostake',
    descI18nKey: 'decreaseCostakeDesc',
    successPageTitle: 'unlock',
    successType: 'unlock',
    operationStatusTitle: 'Unlocking',
    submitButtonI18nKey: 'decrease',
    operationKind: 'unstake'
  }
};

interface StakeAmountFormProps {
  mode: StakeMode;
  /** For increase mode: compute maxAmount externally using fee data */
  maxAmount?: BigNumber;
  /** For increase mode: external error from fee estimation */
  externalError?: Error | null;
  /** For increase mode: the staked amount display (converted from atoms) */
  stakedAmountDisplay?: BigNumber;
  /** For increase mode: fee estimation object for pending operation */
  estimation?: any;
}

export const StakeAmountForm: FC<StakeAmountFormProps> = ({
  mode,
  maxAmount: externalMaxAmount,
  externalError,
  stakedAmountDisplay,
  estimation: externalEstimation
}) => {
  const config = MODE_CONFIG[mode];
  const { historyPosition } = useLocation();
  const { unfamiliarWithDelegation } = useBakingHistory();
  const account = useAccount();
  const chainId = useChainId();
  const { data: { myBakerPkh, canUnlock, canCostake, stakedBalance } = {} } = useAccountDelegatePeriodStats(
    account.publicKeyHash
  );
  const { value: balanceData = ZERO } = useBalance(MAV_TOKEN_SLUG, account.publicKeyHash);
  const balance = balanceData!;

  const amountFieldRef = React.useRef<HTMLInputElement>(null);
  const assetMetadata = useAssetMetadata(MAV_TOKEN_SLUG);
  const mavryk = useMavryk();

  const formAnalytics = useFormAnalytics(config.formAnalyticsName);

  const {
    watch,
    handleSubmit,
    formState: { errors, ...formState },
    control,
    setValue,
    trigger
  } = useForm<FormData>({
    mode: 'onChange'
  });
  const [submitError, setSubmitError] = useSafeState<Error | null>(null);
  const [operation, setOperation] = useSafeState<any>(null, mavryk.checksum);

  const canSubmit = mode === 'increase' ? canCostake : canUnlock;

  useEffect(() => {
    if (account.type === TempleAccountType.WatchOnly) {
      navigate('/');
    } else if (unfamiliarWithDelegation) {
      navigate('stake');
    }
  }, [unfamiliarWithDelegation, account.publicKeyHash, account.type]);

  const amountValue = watch('amount');

  useEffect(() => {
    if (operation && (!operation._operationResult?.hasError || !operation._operationResult?.isStopped)) {
      const hash = operation.hash || operation.opHash;
      navigate<SuccessStateType>('/success', undefined, {
        pageTitle: config.successPageTitle,
        btnText: 'viewHistoryTab',
        btnLink: '?tab=history',
        contentId: 'DelegationOperation',
        contentIdFnProps: {
          hash,
          assetSlug: MAV_TOKEN_SLUG,
          amount: amountValue,
          validatorAddress: myBakerPkh,
          type: config.successType
        }
      });
    }
  }, [amountValue, config.successPageTitle, config.successType, myBakerPkh, operation]);

  useEffect(() => {
    if (externalError) {
      setSubmitError(externalError);
    }
  }, [externalError, setSubmitError]);

  const stakedBalanceAsTokens = useTokenAmount(stakedBalance, assetMetadata);

  // For decrease mode, maxAmount is derived from stakedBalance
  // For increase mode, maxAmount is passed in externally (computed with fees)
  const maxAmount = useMemo(() => {
    if (mode === 'decrease') {
      return stakedBalanceAsTokens;
    }
    return externalMaxAmount;
  }, [mode, stakedBalanceAsTokens, externalMaxAmount]);

  // For increase mode, stakedAmountDisplay is passed in; for decrease, derive it from stakedBalance
  const computedStakedAmount = useMemo(() => {
    if (mode === 'increase' && stakedAmountDisplay) {
      return stakedAmountDisplay;
    }
    // For decrease mode, maxAmount IS the staked amount
    return maxAmount;
  }, [mode, stakedAmountDisplay, maxAmount]);

  const validateAmount = useCallback(
    (v?: string) => {
      if (v === undefined || v === '') return t('required');

      const validationLimit = mode === 'decrease' ? maxAmount : balance;
      if (!validationLimit) return true;
      const vBN = new BigNumber(v);
      return vBN.isLessThanOrEqualTo(validationLimit) || t('maximalAmount', toLocalFixed(validationLimit));
    },
    [mode, maxAmount, balance]
  );

  const handleSetMaxAmount = useCallback(() => {
    if (maxAmount) {
      setValue('amount', maxAmount.toString());
      trigger('amount');
    }
  }, [setValue, maxAmount, trigger]);

  const handleAmountFieldFocus = useCallback<FocusEventHandler>(evt => {
    evt.preventDefault();
    amountFieldRef.current?.focus({ preventScroll: true });
  }, []);

  const onSubmit = useCallback(
    async ({ amount }: FormData) => {
      if (formState.isSubmitting || !myBakerPkh || !canSubmit) return;
      formAnalytics.trackSubmit({ amount });
      try {
        if (!assetMetadata) throw new Error('Metadata not found');

        let op: any;
        let estmtn: any;

        if (mode === 'decrease') {
          estmtn = await mavryk.estimate.unstake({ amount: Number(amount) });
          op = await mavryk.wallet.unstake({ amount: Number(amount) }).send();
        } else {
          op = await mavryk.wallet
            // eslint-disable-next-line no-type-assertion/no-type-assertion
            .stake({ amount: new BigNumber(amount).toNumber() } as any)
            .send();
          estmtn = externalEstimation;
        }

        // create pending delegate operation
        const pendingOpObject = await buildPendingOperationObject({
          operation: op,
          type: 'staking',
          sender: account.publicKeyHash,
          amount: tokensToAtoms(amount, assetMetadata?.decimals ?? MAVEN_METADATA.decimals).toString(),
          estimation: estmtn,
          baker: myBakerPkh,
          kind: config.operationKind
        });
        if (pendingOpObject) await putOperationIntoStorage(chainId, account.publicKeyHash, pendingOpObject);

        setOperation(op);
        formAnalytics.trackSubmitSuccess({ amount });
      } catch (err: unknown) {
        formAnalytics.trackSubmitFail({ amount });

        if (IS_DEV_ENV) console.error('[StakeAmountForm]', err);

        // Human delay.
        await delay();
        setSubmitError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [
      formState.isSubmitting,
      myBakerPkh,
      canSubmit,
      formAnalytics,
      assetMetadata,
      mode,
      mavryk.estimate,
      mavryk.wallet,
      externalEstimation,
      account.publicKeyHash,
      chainId,
      config.operationKind,
      setOperation,
      setSubmitError
    ]
  );

  const balancesData: ManagStakeBalancetype[] = useMemo(() => {
    return [
      {
        id: 1,
        balance: computedStakedAmount ?? ZERO,
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
  }, [assetMetadata, balance, computedStakedAmount]);

  const navigateBack = useCallback(() => {
    if (historyPosition === 0) {
      navigate('/');
    } else {
      goBack();
    }
  }, [historyPosition]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
      <Controller
        name="amount"
        control={control}
        rules={{
          validate: validateAmount
        }}
        render={({ field: { ref: _ref, ...field } }) => (
          <AssetField
            ref={amountFieldRef}
            {...field}
            onChange={(v: any) => field.onChange(v)}
            onFocus={handleAmountFieldFocus}
            id="co-stake-amount"
            assetDecimals={assetMetadata?.decimals ?? 0}
            label={
              <div className="flex items-center gap-1">
                <T id={config.labelI18nKey} />
                <InfoTooltip content={<T id={config.descI18nKey} />} />
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
        )}
      />
      <div className="flex flex-col gap-1 flex-1">
        {balancesData.map(({ id, ...rest }) => (
          <ManageStakeUnderTextFieldBalance key={id} {...rest} />
        ))}
      </div>
      {operation && (
        <OperationStatus typeTitle={config.operationStatusTitle} operation={operation} className="mb-8 px-4" />
      )}
      <div className="grid grid-cols-2 gap-3 w-full mt-6">
        <ButtonRounded size="big" fill={false} onClick={navigateBack} type="button">
          <T id="cancel" />
        </ButtonRounded>
        <FormSubmitButton
          loading={formState.isSubmitting}
          disabled={Boolean(
            formState.isSubmitting ||
              errors.amount ||
              !formState.isValid ||
              !amountValue ||
              amountValue === '0' ||
              !canSubmit
          )}
        >
          <T id={config.submitButtonI18nKey} />
        </FormSubmitButton>
      </div>
    </form>
  );
};
