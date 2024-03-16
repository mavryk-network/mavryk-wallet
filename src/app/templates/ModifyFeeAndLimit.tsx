import React, { FC, useMemo } from 'react';

import { Estimate } from '@taquito/taquito';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { Money } from 'app/atoms';
import PlainAssetInput from 'app/atoms/PlainAssetInput';
import InFiat from 'app/templates/InFiat';
import { T, t } from 'lib/i18n';
import { RawOperationAssetExpense, RawOperationExpenses, useGasToken } from 'lib/temple/front';
import { mutezToTz, tzToMutez } from 'lib/temple/helpers';

type OperationAssetExpense = Omit<RawOperationAssetExpense, 'tokenAddress'> & {
  assetSlug: string;
};

type OperationExpenses = Omit<RawOperationExpenses, 'expenses'> & {
  expenses: OperationAssetExpense[];
};

type ModifyFeeAndLimitProps = {
  expenses?: OperationExpenses[];
  estimates?: Estimate[];
  mainnet?: boolean;
  modifyFeeAndLimit?: ModifyFeeAndLimit;
  gasFeeError?: boolean;
  includeBurnedFee?: boolean;
  hasStableGasFee?: boolean;
};

export interface ModifyFeeAndLimit {
  totalFee: number;
  onTotalFeeChange: (totalFee: number) => void;
  storageLimit: number | null;
  onStorageLimitChange: (storageLimit: number) => void;
}

const MAX_GAS_FEE = 1000;

export const ModifyFeeAndLimitComponent: FC<ModifyFeeAndLimitProps> = ({
  expenses,
  estimates,
  mainnet,
  modifyFeeAndLimit,
  gasFeeError,
  includeBurnedFee = true,
  hasStableGasFee = false
}) => {
  const { symbol } = useGasToken();

  const modifyFeeAndLimitSection = useMemo(() => {
    if (!modifyFeeAndLimit) return null;

    let defaultGasFeeMutez = new BigNumber(0);
    let storageFeeMutez = new BigNumber(0);
    let burnedFee = new BigNumber(0);

    if (estimates) {
      try {
        let i = 0;
        for (const e of estimates) {
          defaultGasFeeMutez = defaultGasFeeMutez.plus(e.suggestedFeeMutez);
          storageFeeMutez = storageFeeMutez.plus(
            Math.ceil(
              (i === 0 ? modifyFeeAndLimit.storageLimit ?? e.storageLimit : e.storageLimit) *
                (e as any).minimalFeePerStorageByteMutez
            )
          );
          i++;
        }

        // @ts-expect-error
        burnedFee = new BigNumber(estimates[0].burnFeeMutez + estimates[0]?.baseFeeMutez ?? 0).plus(storageFeeMutez);
      } catch {
        return null;
      }
    }

    const gasFee = mutezToTz(modifyFeeAndLimit.totalFee);
    const defaultGasFee = mutezToTz(defaultGasFeeMutez);
    const storageFee = mutezToTz(storageFeeMutez);

    return (
      <div className="w-full flex flex-col gap-3">
        {[
          {
            key: 'totalFee',
            title: t('gasFee'),
            value: gasFee,
            onChange: hasStableGasFee ? undefined : modifyFeeAndLimit.onTotalFeeChange
          },
          {
            key: 'storageFeeMax',
            title: t('storageFeeMax'),
            value: storageFee
          },

          ...(modifyFeeAndLimit.storageLimit !== null
            ? [
                {
                  key: 'storageLimit',
                  title: t('storageLimit'),
                  value: modifyFeeAndLimit.storageLimit,
                  onChange: modifyFeeAndLimit.onStorageLimitChange
                }
              ]
            : []),
          ...(includeBurnedFee
            ? [
                includeBurnedFee && {
                  key: 'feesBurned',
                  title: t('feesBurned'),
                  value: mutezToTz(burnedFee)
                }
              ]
            : [])
        ].map(({ key, title, value, onChange }) => (
          <div key={key} className={classNames('w-full flex items-center')}>
            <div className="whitespace-nowrap overflow-x-auto no-scrollbar opacity-90" style={{ maxWidth: '45%' }}>
              {title}
            </div>

            <div className="flex-1" />

            {value instanceof BigNumber ? (
              <>
                <div className="mr-1">
                  {onChange ? (
                    <>
                      <PlainAssetInput
                        value={value.toFixed()}
                        onChange={val => {
                          onChange?.(tzToMutez(val ?? defaultGasFee).toNumber());
                        }}
                        max={MAX_GAS_FEE}
                        placeholder={defaultGasFee.toFixed()}
                        className={classNames(
                          'mr-1',
                          'appearance-none',
                          'w-24',
                          'px-2 py-1',
                          'border',
                          gasFeeError ? 'border-primary-error' : 'border-gray-50',
                          'focus:border-accent-blue',
                          'bg-primary-bg',
                          'transition ease-in-out duration-200',
                          'rounded',
                          'text-right',
                          'text-white text-base-plus',
                          'placeholder-text-secondary-white'
                        )}
                      />
                      <span style={{ maxHeight: 19 }}>{symbol}</span>
                    </>
                  ) : (
                    <span className="flex items-baseline" style={{ maxHeight: 19 }}>
                      <Money>{value}</Money>
                      <span className="ml-1">{symbol}</span>
                    </span>
                  )}
                </div>

                <InFiat volume={value} roundingMode={BigNumber.ROUND_UP} mainnet={mainnet}>
                  {({ balance, symbol }) => (
                    <div className="flex">
                      <span className="opacity-75">(</span>
                      <span style={{ maxHeight: 19 }}>{symbol}</span>
                      {balance}
                      <span className="opacity-75">)</span>
                    </div>
                  )}
                </InFiat>
              </>
            ) : (
              <div className="flex items-center mr-1">
                <input
                  type="number"
                  value={value || ''}
                  onChange={e => {
                    if (e.target.value.length > 8) return;
                    const val = +e.target.value;
                    onChange?.(val > 0 ? val : 0);
                  }}
                  placeholder="0"
                  className={classNames(
                    'appearance-none',
                    'w-24',
                    'py-1 px-2 mr-1',
                    'border',
                    'border-gray-50',
                    'focus:border-accent-blue',
                    'bg-primary-bg',
                    'transition ease-in-out duration-200',
                    'rounded',
                    'text-right',
                    'text-white text-base-plus',
                    'placeholder-secondary-white'
                  )}
                />
                <span style={{ maxHeight: 19 }}>{symbol}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }, [modifyFeeAndLimit, estimates, includeBurnedFee, gasFeeError, symbol, mainnet]);

  if (!expenses) {
    return null;
  }

  return modifyFeeAndLimit ? (
    <>
      <div className="text-white text-base-plus mt-4 pb-3">
        <T id="payment" />
      </div>
      <div className="flex-1" />

      <div
        className={classNames(
          'flex items-center',
          'p-4 rounded-2xl-plus',
          'bg-primary-card',
          'text-base-plus text-white'
        )}
      >
        {modifyFeeAndLimitSection}
      </div>
    </>
  ) : null;
};
