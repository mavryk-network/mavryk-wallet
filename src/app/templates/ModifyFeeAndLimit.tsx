import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import { Estimate } from '@mavrykdynamics/taquito';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { useForm } from 'react-hook-form';

import { Alert, Money } from 'app/atoms';
import PlainAssetInput from 'app/atoms/PlainAssetInput';
import { useAppEnv } from 'app/env';
import InFiat from 'app/templates/InFiat';
import { useGasToken } from 'lib/assets/hooks';
import { T, t } from 'lib/i18n';
import { RawOperationAssetExpense, RawOperationExpenses } from 'lib/temple/front';
import { mumavToTz, tzToMumav } from 'lib/temple/helpers';

import { AdditionalGasInput, gasOptions } from './AdditionalFeeInput';

interface FormData {
  fee: number;
}

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
  includeStorageData?: boolean;
};

export interface ModifyFeeAndLimit {
  totalFee: number;
  onTotalFeeChange: (totalFee: number) => void;
  storageLimit: number | null;
  onStorageLimitChange: (storageLimit: number) => void;
}

const MAX_GAS_FEE = 1000;
const DEFAULT_MINIMAL_FEE_PER_STORAGE_MUMAV = 250;

export const ModifyFeeAndLimitComponent: FC<ModifyFeeAndLimitProps> = ({
  expenses,
  estimates,
  mainnet,
  modifyFeeAndLimit,
  gasFeeError,
  includeBurnedFee = true,
  hasStableGasFee = false,
  includeStorageData = true
}) => {
  const { symbol } = useGasToken();
  const { popup } = useAppEnv();

  const hasRun = useRef(false);

  const initialFeeValues = useMemo(
    () => ({
      gas: modifyFeeAndLimit?.totalFee ?? 0,
      storage: modifyFeeAndLimit?.storageLimit ?? null
    }),
    []
  );

  const { control } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      fee: gasOptions[1].amount
    }
  });

  // muptiple storage and gas fees by selected option [1, 1.5, 2]
  const handleGasFeeChange = useCallback(
    (val: [string]) => {
      if (modifyFeeAndLimit) {
        const { onStorageLimitChange, onTotalFeeChange } = modifyFeeAndLimit;
        const { gas, storage } = initialFeeValues;
        const [stringMultiplier] = val;
        const multiplier = Number(stringMultiplier);

        onTotalFeeChange(gas * multiplier);

        storage && onStorageLimitChange?.(storage * multiplier);
      }
    },
    [modifyFeeAndLimit, initialFeeValues]
  );

  // increase default estimated fees
  useEffect(() => {
    if (!hasRun.current && modifyFeeAndLimit) {
      const { onStorageLimitChange, onTotalFeeChange, totalFee, storageLimit } = modifyFeeAndLimit;
      const multiplier = 1.5;

      onTotalFeeChange(totalFee * multiplier);
      storageLimit && onStorageLimitChange?.(storageLimit * multiplier);

      hasRun.current = true;
    }
  }, [modifyFeeAndLimit, handleGasFeeChange]);

  const modifyFeeAndLimitSection = useMemo(() => {
    if (!modifyFeeAndLimit) return null;

    let defaultGasFeeMumav = new BigNumber(0);
    let storageFeeMumav = new BigNumber(0);
    let burnedFee = new BigNumber(0);

    if (estimates) {
      try {
        let i = 0;
        for (const e of estimates) {
          defaultGasFeeMumav = defaultGasFeeMumav.plus(e.suggestedFeeMumav);

          storageFeeMumav = storageFeeMumav.plus(
            Math.ceil(
              (i === 0 ? modifyFeeAndLimit.storageLimit ?? e.storageLimit : e.storageLimit) *
                (e as any).minimalFeePerStorageByteMumav
            )
          );
          i++;
        }

        burnedFee = new BigNumber(modifyFeeAndLimit.totalFee ?? 0).plus(storageFeeMumav).multipliedBy(0.5);
      } catch {
        return null;
      }
    } else {
      // calculate burned with default state values in case estimation got 404 error response
      const { totalFee, storageLimit } = modifyFeeAndLimit;
      burnedFee = new BigNumber(totalFee ?? 0).plus(storageLimit ?? 0).multipliedBy(0.5);

      storageFeeMumav = storageFeeMumav.plus(
        Math.ceil((modifyFeeAndLimit.storageLimit ?? 0) * DEFAULT_MINIMAL_FEE_PER_STORAGE_MUMAV)
      );
    }

    const gasFee = mumavToTz(modifyFeeAndLimit.totalFee);

    const storageFee = mumavToTz(storageFeeMumav);
    const defaultGasFee = mumavToTz(defaultGasFeeMumav);

    return (
      <div className="w-full flex flex-col gap-3">
        {[
          {
            key: 'totalFee',
            title: t('gasFee'),
            value: gasFee,
            onChange: hasStableGasFee ? undefined : modifyFeeAndLimit.onTotalFeeChange
          },
          ...(includeStorageData
            ? [
                {
                  key: 'storageFeeMax',
                  title: t('storageFeeMax'),
                  value: storageFee
                }
              ]
            : []),

          ...(modifyFeeAndLimit.storageLimit !== null && includeStorageData
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
                  value: mumavToTz(burnedFee)
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
                          onChange?.(tzToMumav(val ?? defaultGasFee).toNumber());
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
                      {key === 'feesBurned' && '~'}
                      <Money smallFractionFont={false}>{value}</Money>
                      <span className="ml-1">{symbol}</span>
                    </span>
                  )}
                </div>

                <InFiat volume={value} roundingMode={BigNumber.ROUND_UP} mainnet={mainnet} smallFractionFont={false}>
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
  }, [
    modifyFeeAndLimit,
    estimates,
    hasStableGasFee,
    includeStorageData,
    includeBurnedFee,
    gasFeeError,
    symbol,
    mainnet
  ]);

  if (!expenses) {
    return null;
  }

  return modifyFeeAndLimit ? (
    <>
      <div className="my-4">
        <Alert type="warning" title={t('attention')} description={<T id="highTrafficMsg" />} />
      </div>
      <div>
        <AdditionalGasInput name="fee" control={control} onChange={handleGasFeeChange} id="gas-fee-confirmation" />
      </div>
      <div className="text-white text-base-plus mt-4 pb-3">
        <T id="networkFees" />
      </div>
      {popup && <div className="flex-1" />}
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
