import React, { FC, FocusEventHandler, useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import clsx from 'clsx';
import { Controller, useForm } from 'react-hook-form';

import { Alert, FormSubmitButton } from 'app/atoms';
import AssetField from 'app/atoms/AssetField';
import { MaxButton } from 'app/atoms/MaxButton';
import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';
import PageLayout from 'app/layouts/PageLayout';
import AccountBanner from 'app/templates/AccountBanner';
import { CoStakeBakerBanner } from 'app/templates/BakerBanner';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { RECOMMENDED_ADD_FEE } from 'lib/constants';
import { t, toLocalFixed } from 'lib/i18n';
import { useAssetMetadata } from 'lib/metadata';
import { useAccount, useDelegate } from 'lib/temple/front';
import { getMaxAmountToken } from 'lib/utils/amounts';
import { navigate } from 'lib/woozie';

import { useBakingHistory } from '../Stake/hooks/use-baking-history';

interface FormData {
  amount: string;
}

export const CoStake: FC = () => {
  const { unfamiliarWithDelegation } = useBakingHistory();
  const { fullPage, popup } = useAppEnv();
  const account = useAccount();
  const { data: myBakerPkh } = useDelegate(account.publicKeyHash);
  const amountFieldRef = React.useRef<HTMLInputElement>(null);
  const { value: balanceData } = useBalance(MAV_TOKEN_SLUG, account.publicKeyHash);
  const balance = balanceData!;
  const assetMetadata = useAssetMetadata(MAV_TOKEN_SLUG);

  const { watch, handleSubmit, errors, control, formState, setValue, triggerValidation } = useForm<FormData>({
    mode: 'onChange'
  });

  useEffect(() => {
    if (unfamiliarWithDelegation) {
      navigate('stake');
    }
  }, [unfamiliarWithDelegation, account.publicKeyHash]);

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
      if (formState.isSubmitting) return;
      try {
        if (!assetMetadata) throw new Error('Metadata not found');
        console.log('amount', amount);
      } catch (err: any) {}
    },
    [assetMetadata, formState.isSubmitting]
  );

  return (
    <PageLayout isTopbarVisible={false} pageTitle={'Co-stake'} removePaddings={popup}>
      <ContentContainer className={clsx('h-full flex-1 flex flex-col text-white', !fullPage && 'pb-8 pt-4')}>
        <AccountBanner account={account} showMVRK className="mb-4" />
        <div>
          <p className="text-base-plus mb-3">Stake to</p>
          {myBakerPkh && <CoStakeBakerBanner bakerPkh={myBakerPkh} />}
          <Alert
            type="info"
            className="my-4"
            title="Manage, adjust, or co-stake your MVRK"
            description="You can choose to co-stake only a portion of your MVRK, without needing to commit all of it."
          />
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
              id="send-amount"
              assetDecimals={assetMetadata?.decimals ?? 0}
              label={'Co-stake Amount'}
              placeholder={'Enter amount'}
              errorCaption={errors.amount?.message}
              containerClassName="mb-3"
              autoFocus={Boolean(maxAmount)}
              extraInner={<MaxButton onClick={handleSetMaxAmount} fill={false} className="relative z-10" />}
            />
            <div className="flex text-sm gap-1 mb-6">
              <p className="text-secondary-white">Delegated Amount </p>
              <p className="text-white">
                {12} {assetMetadata?.symbol}
              </p>
            </div>
            <FormSubmitButton
              loading={formState.isSubmitting}
              disabled={Boolean(
                formState.isSubmitting || errors.amount || !formState.isValid || !amountValue || amountValue === '0'
              )}
              className="my-6"
            >
              Co-stake
            </FormSubmitButton>
          </form>
        </div>
      </ContentContainer>
    </PageLayout>
  );
};
