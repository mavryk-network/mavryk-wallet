import React, { FC, FocusEventHandler, useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import clsx from 'clsx';
import { Controller, useForm } from 'react-hook-form';

import { Alert, FormSubmitButton, Money } from 'app/atoms';
import AssetField from 'app/atoms/AssetField';
import { MaxButton } from 'app/atoms/MaxButton';
import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';
import PageLayout from 'app/layouts/PageLayout';
import AccountBanner from 'app/templates/AccountBanner';
import { CoStakeBakerBanner } from 'app/templates/BakerBanner';
import OperationStatus from 'app/templates/OperationStatus';
import { useFormAnalytics } from 'lib/analytics';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { RECOMMENDED_ADD_FEE } from 'lib/constants';
import { T, t, toLocalFixed } from 'lib/i18n';
import { MAVEN_METADATA, useAssetMetadata } from 'lib/metadata';
import { useAccount, useKnownBaker, useTezos } from 'lib/temple/front';
import { useAccountDelegatePeriodStats } from 'lib/temple/front/baking';
import { atomsToTokens } from 'lib/temple/helpers';
import { useSafeState } from 'lib/ui/hooks';
import { delay } from 'lib/utils';
import { getMaxAmountToken } from 'lib/utils/amounts';
import { navigate } from 'lib/woozie';

import { useBakingHistory } from '../Stake/hooks/use-baking-history';
import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

interface FormData {
  amount: string;
}

export const CoStake: FC = () => {
  const { unfamiliarWithDelegation } = useBakingHistory();
  const { fullPage, popup } = useAppEnv();
  const account = useAccount();
  const { myBakerPkh, canCostake } = useAccountDelegatePeriodStats(account.publicKeyHash);

  const { data: baker } = useKnownBaker(myBakerPkh ?? null);
  const amountFieldRef = React.useRef<HTMLInputElement>(null);
  const { value: balanceData } = useBalance(MAV_TOKEN_SLUG, account.publicKeyHash);
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
    if (unfamiliarWithDelegation) {
      navigate('stake');
    }
  }, [unfamiliarWithDelegation, account.publicKeyHash]);

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

  const delegatedAmount = useMemo(() => {
    return atomsToTokens(new BigNumber(baker?.stakedBalance ?? 0), assetMetadata?.decimals || MAVEN_METADATA.decimals);
  }, [assetMetadata, baker]);

  return (
    <PageLayout isTopbarVisible={false} pageTitle={'Co-stake'} removePaddings={popup}>
      <ContentContainer className={clsx('h-full flex-1 flex flex-col text-white', !fullPage && 'pb-8 pt-4')}>
        <AccountBanner account={account} showMVRK className="mb-4" />
        <div>
          <p className="text-base-plus mb-3">Stake to</p>
          {myBakerPkh && <CoStakeBakerBanner bakerPkh={myBakerPkh} />}
          <Alert type="info" className="my-4" title={t('manageMVRK')} description={t('choosePortionMVRK')} />
          <form onSubmit={handleSubmit(onSubmit)}>
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
              label={'Co-stake Amount'}
              placeholder={'Enter amount'}
              errorCaption={errors.amount?.message || submitError?.message}
              containerClassName="mb-3"
              autoFocus={Boolean(maxAmount)}
              extraInnerWrapper="unset"
              extraInner={
                <div className="absolute flex items-center justify-end inset-y-0 right-4 w-32">
                  <MaxButton type="button" onClick={handleSetMaxAmount} fill={false} className="relative z-10" />
                </div>
              }
            />
            <div className="flex text-sm gap-1 mb-6 items-center">
              <p className="text-secondary-white">
                <T id="delegatedAmount" />
              </p>
              <div className="text-white">
                <div className="text-white text-sm flex items-center">
                  <div className={clsx('text-sm leading-none', 'text-white')}>
                    <Money smallFractionFont={false}>{delegatedAmount}</Money> <span>{assetMetadata?.symbol}</span>
                  </div>
                </div>
              </div>
            </div>
            {operation && <OperationStatus typeTitle={'Co-staking'} operation={operation} className="mb-8 px-4" />}
            <FormSubmitButton
              loading={formState.isSubmitting}
              disabled={Boolean(
                formState.isSubmitting || errors.amount || !formState.isValid || !amountValue || amountValue === '0'
              )}
              className="my-6"
            >
              <T id="coStake" />
            </FormSubmitButton>
          </form>
        </div>
      </ContentContainer>
    </PageLayout>
  );
};
