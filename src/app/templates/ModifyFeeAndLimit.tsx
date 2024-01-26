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
  gasFeeError
}) => {
  const { symbol } = useGasToken();

  const modifyFeeAndLimitSection = useMemo(() => {
    if (!modifyFeeAndLimit) return null;

    let defaultGasFeeMutez = new BigNumber(0);
    let storageFeeMutez = new BigNumber(0);
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
            onChange: modifyFeeAndLimit.onTotalFeeChange
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
            : [])
        ].map(({ key, title, value, onChange }, i, arr) => (
          <div key={key} className={classNames('w-full flex items-center', i !== arr.length - 1 && 'mb-1')}>
            <div className="whitespace-nowrap overflow-x-auto no-scrollbar opacity-90" style={{ maxWidth: '45%' }}>
              {title}
            </div>
            <div className="mr-1">:</div>

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
                      {symbol}
                    </>
                  ) : (
                    <span className="flex items-baseline">
                      <Money>{value}</Money>
                      <span className="ml-1">{symbol}</span>
                    </span>
                  )}
                </div>

                <InFiat volume={value} roundingMode={BigNumber.ROUND_UP} mainnet={mainnet}>
                  {({ balance, symbol }) => (
                    <div className="flex">
                      <span className="opacity-75">(</span>
                      {balance}
                      <span className="pr-px ml-1">{symbol}</span>
                      <span className="opacity-75">)</span>
                    </div>
                  )}
                </InFiat>
              </>
            ) : (
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
                  'py-1 px-2',
                  'border',
                  'border-gray-50',
                  'focus:border-accent-blue',
                  'bg-primary-bg',
                  'transition ease-in-out duration-200',
                  'rounded',
                  'text-right',
                  'text-white text-base-plus leading-tight',
                  'placeholder-secondary-white'
                )}
              />
            )}
          </div>
        ))}
      </div>
    );
  }, [modifyFeeAndLimit, estimates, gasFeeError, mainnet, symbol]);

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
          'sticky bottom-0 left-0 right-0',
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
