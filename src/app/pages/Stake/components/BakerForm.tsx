import React, { ReactNode, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { Control, FieldErrors, UseFormTrigger } from 'react-hook-form';

import { FormSubmitButton, HashChip } from 'app/atoms';
import Spinner from 'app/atoms/Spinner/Spinner';
import { ArtificialError } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { AdditionalFeeInput } from 'app/templates/AdditionalFeeInput/AdditionalFeeInput';
import { ABTestGroup } from 'lib/apis/temple';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { t } from 'lib/i18n';
import { RECOMMENDED_BAKER_ADDRESS } from 'lib/known-bakers';
import { MAVEN_METADATA } from 'lib/metadata';
import { Baker, useAccount } from 'lib/temple/front';
import { calculateCapacities } from 'lib/temple/front/baking/utils';

import { useUserTestingGroupNameSelector } from '../../../store/ab-testing/selectors';
import { DelegateFormSelectors } from '../delegateForm.selectors';

import { BakerBannerComponent } from './BakerBannerComponent';
import { DelegateErrorAlert } from './DelegateErrorAlert';
import { UnchangedError, UnregisteredDelegateError } from './delegate-errors';
import { KnownDelegatorsList } from './KnownDelegatorsList';

interface FormData {
  to: string;
  fee: number;
}

export interface BakerFormProps {
  baker: Baker | null | undefined;
  toFilled: boolean | '';
  submitError: ReactNode;
  estimationError: any;
  estimating: boolean;
  bakerValidating: boolean;
  restFormDisplayed: boolean;
  toValue: string;
  baseFee?: BigNumber | ArtificialError | UnchangedError | UnregisteredDelegateError;
  control: Control<FormData>;
  handleFeeFieldChange: ([v]: any) => any;
  errors: FieldErrors<FormData>;
  setValue: any;
  trigger: UseFormTrigger<FormData>;
  formState: { isSubmitting: boolean };
}

export const BakerForm: React.FC<BakerFormProps> = ({
  baker,
  submitError,
  estimationError,
  estimating,
  bakerValidating,
  toFilled,
  baseFee,
  control,
  errors,
  handleFeeFieldChange,
  setValue,
  trigger,
  formState,
  restFormDisplayed,
  toValue
}) => {
  const { popup } = useAppEnv();
  const testGroupName = useUserTestingGroupNameSelector();
  const estimateFallbackDisplayed = toFilled && !baseFee && (estimating || bakerValidating);
  const memoizedBakerStyles = useMemo(() => ({ ...(!popup ? { paddingInline: 0, paddingTop: 0 } : {}) }), [popup]);

  const acc = useAccount();
  const accountPkh = acc.publicKeyHash;

  const { rawValue } = useBalance(MAV_TOKEN_SLUG, accountPkh);

  const { delegatedFreeSpace } = useMemo(() => {
    const { stakedBalance, delegatedBalance, externalStakedBalance } = baker ?? {
      stakedBalance: 0,
      delegatedBalance: 0,
      externalStakedBalance: 0
    };
    return calculateCapacities({ stakedBalance, delegatedBalance, externalStakedBalance });
  }, [baker]);

  const bakerTestMessage = useMemo(() => {
    if (baker?.address !== RECOMMENDED_BAKER_ADDRESS) {
      return 'Unknown Delegate Button';
    }

    if (testGroupName === ABTestGroup.B) {
      return 'Known B Delegate Button';
    }

    return 'Known A Delegate Button';
  }, [baker?.address, testGroupName]);

  if (estimateFallbackDisplayed) {
    return (
      <div className="flex justify-center my-8">
        <Spinner className="w-20" />
      </div>
    );
  }
  const tzError = submitError || estimationError;
  const hasLowBalance = new BigNumber(rawValue ?? 0).isLessThan(baker?.minDelegation ?? 0);
  const isBakerOverDelegated = delegatedFreeSpace < 0;
  const isDelegateBtnDisabled = Boolean(estimationError) || hasLowBalance || isBakerOverDelegated;

  return restFormDisplayed ? (
    <div className="flex-grow flex flex-col mt-2">
      <BakerBannerComponent baker={baker} tzError={tzError} style={memoizedBakerStyles} />
      <div className={classNames('px-3 py-2 bg-primary-card rounded-lg mb-6', popup && 'mx-4')}>
        <HashChip hash={toValue} type="link" small trim={false} />
      </div>

      <div className={classNames('h-full flex flex-col flex-grow', popup && 'px-4')}>
        <div className={classNames(!Boolean(tzError) && 'flex-grow')}>
          <AdditionalFeeInput
            name="fee"
            control={control}
            onChange={handleFeeFieldChange}
            assetSymbol={MAVEN_METADATA.symbol}
            baseFee={baseFee}
            error={errors.fee}
            id="delegate-fee"
          />
        </div>

        {tzError && (
          <div className="flex-grow flex items-start">
            <DelegateErrorAlert type={submitError ? 'submit' : 'estimation'} error={tzError} />
          </div>
        )}

        <FormSubmitButton
          loading={formState.isSubmitting}
          disabled={isDelegateBtnDisabled}
          className="mt-6"
          testID={DelegateFormSelectors.bakerDelegateButton}
          testIDProperties={{
            message: bakerTestMessage
          }}
        >
          {t('delegate')}
        </FormSubmitButton>
      </div>
    </div>
  ) : (
    <KnownDelegatorsList setValue={setValue} trigger={trigger} />
  );
};
