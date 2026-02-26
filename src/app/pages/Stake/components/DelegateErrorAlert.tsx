import React, { FC } from 'react';

import { Alert } from 'app/atoms';
import { NotEnoughFundsError, ZeroBalanceError } from 'app/defaults';
import { useGasToken } from 'lib/assets/hooks';
import { T, t } from 'lib/i18n';

import { UnchangedError, UnregisteredDelegateError } from './delegate-errors';

type DelegateErrorAlertProps = {
  type: 'submit' | 'estimation';
  error: Error;
};

export const DelegateErrorAlert: FC<DelegateErrorAlertProps> = ({ type, error }) => {
  const { symbol } = useGasToken();

  return (
    <Alert
      type={type === 'submit' ? 'error' : 'warning'}
      title={(() => {
        switch (true) {
          case error instanceof NotEnoughFundsError:
            return `${t('notEnoughFunds')} \u{1F636}`;

          case [UnchangedError, UnregisteredDelegateError].some(Err => error instanceof Err):
            return t('notAllowed');

          default:
            return t('failed');
        }
      })()}
      description={(() => {
        switch (true) {
          case error instanceof ZeroBalanceError:
            return t('yourBalanceIsZero');

          case error instanceof NotEnoughFundsError:
            return t('minimalFeeGreaterThanBalance');

          case error instanceof UnchangedError:
            return t('alreadyDelegatedFundsToBaker');

          case error instanceof UnregisteredDelegateError:
            return t('bakerNotRegistered');

          default:
            return (
              <>
                <T
                  id="unableToPerformActionToBaker"
                  substitutions={t(type === 'submit' ? 'delegate' : 'estimateDelegation').toLowerCase()}
                />

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
      className="my-6"
    />
  );
};
