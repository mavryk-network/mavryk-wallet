import React, { memo } from 'react';

import { HttpResponseError } from '@mavrykdynamics/webmavryk-http-utils';

import { Alert } from 'app/atoms';
import { NotEnoughFundsError, ZeroBalanceError, ZeroTEZBalanceError } from 'app/defaults';
import { useGasToken } from 'lib/assets/hooks';
import { T, TID, t } from 'lib/i18n';
import { AssetMetadataBase, isRwa } from 'lib/metadata';

interface Props {
  type: 'submit' | 'estimation';
  error: unknown;
  assetMetadata?: AssetMetadataBase | nullish;
  senderIsKYC?: boolean;
}

const SendErrorAlert = memo<Props>(({ type, error, assetMetadata, senderIsKYC }) => {
  const { symbol } = useGasToken();
  const rwaKycWarning = getRwaKycEstimationWarning(type, error, assetMetadata, senderIsKYC);

  if (rwaKycWarning) {
    return (
      <Alert
        type="warning"
        title={t('attentionExclamation')}
        description={<T id={rwaKycWarning} />}
        autoFocus
        className="my-4"
      />
    );
  }

  return (
    <Alert
      type={type === 'submit' ? 'error' : 'warning'}
      title={(() => {
        switch (true) {
          case error instanceof ZeroTEZBalanceError:
            return `${t('notEnoughCurrencyFunds', 'ꝳ')} 😶`;

          case error instanceof NotEnoughFundsError:
            return `${t('notEnoughFunds')} 😶`;

          default:
            return t('failed');
        }
      })()}
      description={(() => {
        switch (true) {
          case error instanceof ZeroBalanceError:
            return t('yourBalanceIsZero');

          case error instanceof ZeroTEZBalanceError:
            return t('mainAssetBalanceIsZero');

          case error instanceof NotEnoughFundsError:
            return t('minimalFeeGreaterThanBalanceVerbose');

          case isCounterError(error):
            return 'counterIsOffOperationError';

          default:
            return (
              <>
                <T id={type === 'submit' ? 'unableToSendTransactionAction' : 'unableToEstimateTransactionAction'} />
                <br />
                <T id="thisMayHappenBecause" />
                <ul className="mt-1 ml-2 text-xs list-disc list-inside">
                  <li>
                    <T id="minimalFeeGreaterThanBalanceVerbose" substitutions={symbol} />
                  </li>
                  <li>
                    <T id="networkOrOtherIssue" />
                  </li>
                </ul>
              </>
            );
        }
      })()}
      autoFocus
      className="my-4"
    />
  );
});

export default SendErrorAlert;

const isCounterError = (error: unknown) =>
  error instanceof HttpResponseError && error.message.includes('counter_in_the_');

type RwaKycEstimationWarning = Extract<TID, 'rwaSenderMustBeProToSend' | 'rwaRecipientMustBeProToReceive'>;

const RWA_CANNOT_TRANSFER_ERROR_CODES = ['40', '202'];
const RWA_CANNOT_TRANSFER_ERROR_MESSAGE = 'ERROR_CANNOT_TRANSFER';
const RWA_CANNOT_TRANSFER_ERROR_CODE_PATTERN = /(?:^|[^0-9])(40|202)(?:[^0-9]|$)/;
const MAX_ERROR_SEARCH_DEPTH = 6;

/**
 * Returns a KYC-specific warning only for RWA estimation failures caused by transfer eligibility.
 */
const getRwaKycEstimationWarning = (
  type: Props['type'],
  error: unknown,
  assetMetadata: AssetMetadataBase | nullish,
  senderIsKYC: boolean | undefined
): RwaKycEstimationWarning | null => {
  if (type !== 'estimation' || !assetMetadata || !isRwa(assetMetadata) || !isRwaCannotTransferError(error)) {
    return null;
  }

  if (senderIsKYC === false) return 'rwaSenderMustBeProToSend';
  if (senderIsKYC === true) return 'rwaRecipientMustBeProToReceive';

  return null;
};

const isRwaCannotTransferError = (error: unknown) => containsCannotTransferValue(error, 0);

const containsCannotTransferValue = (value: unknown, depth: number): boolean => {
  if (depth > MAX_ERROR_SEARCH_DEPTH || value == null) return false;

  if (typeof value === 'number' || typeof value === 'string') {
    return isCannotTransferPrimitive(value);
  }

  if (Array.isArray(value)) {
    return value.some(item => containsCannotTransferValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    return containsCannotTransferObject(value as Record<string, unknown>, depth + 1);
  }

  return false;
};

const containsCannotTransferObject = (value: Record<string, unknown>, depth: number): boolean => {
  const knownErrorValues = [value.message, value.body, value.errors, value.lastError, value.with];

  if (knownErrorValues.some(item => containsCannotTransferValue(item, depth))) return true;

  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key) && containsCannotTransferValue(value[key], depth)) {
      return true;
    }
  }

  return false;
};

const isCannotTransferPrimitive = (value: string | number) => {
  const stringValue = String(value).trim();

  return (
    RWA_CANNOT_TRANSFER_ERROR_CODES.includes(stringValue) ||
    stringValue.toUpperCase().includes(RWA_CANNOT_TRANSFER_ERROR_MESSAGE) ||
    RWA_CANNOT_TRANSFER_ERROR_CODE_PATTERN.test(stringValue)
  );
};
