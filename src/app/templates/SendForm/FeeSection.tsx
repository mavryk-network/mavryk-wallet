import React from 'react';

import BigNumber from 'bignumber.js';
import { FieldError } from 'react-hook-form';

import { Alert } from 'app/atoms';
import { AdditionalFeeInput } from 'app/templates/AdditionalFeeInput/AdditionalFeeInput';
import { useGasToken } from 'lib/assets/hooks';
import { t, T } from 'lib/i18n';
import type { AssetMetadataBase } from 'lib/metadata';
import { useAccount } from 'lib/temple/front';

import SendErrorAlert from './SendErrorAlert';

interface FeeComponentProps extends FeeAlertPropsBase {
  restFormDisplayed: boolean;
  control: any;
  handleFeeFieldChange: ([v]: any) => any;
  baseFee?: BigNumber | Error | undefined;
  error?: FieldError;
  isSubmitting: boolean;
}

export const FeeSection: React.FC<FeeComponentProps> = ({
  restFormDisplayed,
  estimationError,
  control,
  handleFeeFieldChange,
  baseFee,
  error,
  isSubmitting,
  ...rest
}) => {
  const { publicKeyHash, isKYC } = useAccount();
  const { metadata } = useGasToken();

  if (!restFormDisplayed) return null;

  return (
    <>
      <FeeAlert {...rest} estimationError={estimationError} accountPkh={publicKeyHash} senderIsKYC={isKYC} />

      <AdditionalFeeInput
        name="fee"
        control={control}
        onChange={handleFeeFieldChange}
        assetSymbol={metadata.symbol}
        baseFee={baseFee}
        extraHeight={150}
        error={error}
        id="send-fee"
      />
    </>
  );
};

interface FeeAlertPropsBase {
  submitError: unknown;
  estimationError: unknown;
  assetMetadata?: AssetMetadataBase | nullish;
  toResolved: string;
  toFilledWithKTAddress: boolean;
}

interface FeeAlertProps extends FeeAlertPropsBase {
  accountPkh: string;
  senderIsKYC: boolean | undefined;
}

const FeeAlert: React.FC<FeeAlertProps> = ({
  submitError,
  estimationError,
  assetMetadata,
  toResolved,
  toFilledWithKTAddress,
  accountPkh,
  senderIsKYC
}) => {
  if (submitError) return <SendErrorAlert type="submit" error={submitError} />;

  if (estimationError)
    return (
      <SendErrorAlert
        type="estimation"
        error={estimationError}
        assetMetadata={assetMetadata}
        senderIsKYC={senderIsKYC}
      />
    );

  if (toResolved === accountPkh)
    return (
      <Alert
        type="warning"
        title={t('attentionExclamation')}
        description={<T id="tryingToTransferToYourself" />}
        className="my-4"
      />
    );

  if (toFilledWithKTAddress)
    return (
      <Alert
        type="warning"
        title={t('attentionExclamation')}
        description={<T id="tryingToTransferToContract" />}
        className="my-4"
      />
    );

  return null;
};
