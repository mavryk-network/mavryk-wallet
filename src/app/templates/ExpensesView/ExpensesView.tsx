import React, { FC, memo, useMemo } from 'react';

import { Estimate } from '@mavrykdynamics/taquito';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { HashChip, Money, Identicon } from 'app/atoms';
import { ReactComponent as ClipboardIcon } from 'app/icons/clipboard.svg';
import InFiat from 'app/templates/InFiat';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { TProps, T, t } from 'lib/i18n';
import { useAssetMetadata, getAssetSymbol } from 'lib/metadata';
import { RawOperationAssetExpense, RawOperationExpenses } from 'lib/temple/front';

type OperationAssetExpense = Omit<RawOperationAssetExpense, 'tokenAddress'> & {
  assetSlug: string;
};

type OperationExpenses = Omit<RawOperationExpenses, 'expenses'> & {
  expenses: OperationAssetExpense[];
};

type ExpensesViewProps = {
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

const ExpensesView: FC<ExpensesViewProps> = ({ expenses, mainnet, gasFeeError }) => {
  if (!expenses) {
    return null;
  }

  return (
    <>
      <div
        className={classNames('relative no-scrollbar', 'flex flex-col text-white text-sm')}
        style={{ maxHeight: gasFeeError ? '14.5rem' : '15.5rem' }}
      >
        <div className="h-full">
          {expenses.map((item, index, arr) => (
            <ExpenseViewItem key={index} item={item} last={index === arr.length - 1} mainnet={mainnet} />
          ))}
        </div>
      </div>
      {gasFeeError && (
        <p className="text-sm text-primary-error pt-1 h-4">
          <T id="gasFeeMustBePositive" />
        </p>
      )}
    </>
  );
};

export default ExpensesView;

type ExpenseViewItemProps = {
  item: OperationExpenses;
  last: boolean;
  mainnet?: boolean;
};

const ExpenseViewItem: FC<ExpenseViewItemProps> = ({ item, last, mainnet }) => {
  const operationTypeLabel = useMemo(() => {
    switch (item.type) {
      // TODO: add translations for other operations types
      case 'transaction':
      case 'transfer':
        return `↑ ${t('transfer')}`;
      case 'approve':
        return t('approveToken');
      case 'delegation':
        return item.delegate ? t('staking') : t('unStaking');
      default:
        return item.isEntrypointInteraction ? (
          <>
            <ClipboardIcon className="mr-1 h-3 w-auto stroke-current inline align-text-top" />
            <T id="interaction" />
          </>
        ) : (
          t('transactionOfSomeType', item.type)
        );
    }
  }, [item]);

  const { iconHash, iconType, argumentDisplayProps } = useMemo<{
    iconHash: string;
    iconType: 'bottts' | 'jdenticon';
    argumentDisplayProps?: OperationArgumentDisplayProps;
  }>(() => {
    const receivers = [
      ...new Set(
        item.expenses
          .map(({ to }) => to)
          .filter(value => (item.contractAddress ? value !== item.contractAddress : !!value))
      )
    ];

    switch (item.type) {
      case 'transaction':
      case 'transfer':
        return {
          iconHash: item.expenses[0]?.to || 'unknown',
          iconType: 'bottts',
          argumentDisplayProps: {
            i18nKey: 'transferToSmb',
            arg: receivers
          }
        };

      case 'approve':
        return {
          iconHash: item.expenses[0]?.to || 'unknown',
          iconType: 'jdenticon',
          argumentDisplayProps: {
            i18nKey: 'approveForSmb',
            arg: receivers
          }
        };

      case 'delegation':
        if (item.delegate) {
          return {
            iconHash: item.delegate,
            iconType: 'bottts',
            argumentDisplayProps: {
              i18nKey: 'delegationToSmb',
              arg: [item.delegate]
            }
          };
        }

        return {
          iconHash: 'none',
          iconType: 'jdenticon'
        };

      default:
        return item.isEntrypointInteraction
          ? {
              iconHash: item.contractAddress!,
              iconType: 'jdenticon',
              argumentDisplayProps: {
                i18nKey: 'interactionWithContract',
                arg: [item.contractAddress!]
              }
            }
          : {
              iconHash: 'unknown',
              iconType: 'jdenticon'
            };
    }
  }, [item]);

  const withdrawal = useMemo(() => ['transaction', 'transfer'].includes(item.type), [item.type]);

  return (
    <div className={classNames('p-4 flex items-center bg-primary-card rounded-2xl-plus', !last && 'mb-3')}>
      <div className="mr-2">
        <Identicon hash={iconHash} type={iconType} size={32} className="rounded-full" />
      </div>

      <div className="flex-1 flex-col gap-1">
        <div className="flex items-center text-base-plus text-white">
          <span className="mr-1 flex items-center">{operationTypeLabel}</span>

          {argumentDisplayProps && <OperationArgumentDisplay {...argumentDisplayProps} />}
        </div>

        <div className="flex items-end flex-shrink-0 flex-wrap text-secondary-white">
          <div className="flex items-center gap-1">
            {item.expenses
              .filter(expense => new BigNumber(expense.amount).isGreaterThan(0))
              .map((expense, index, arr) => (
                <span key={index}>
                  <OperationVolumeDisplay
                    expense={expense}
                    volume={item.amount}
                    withdrawal={withdrawal}
                    mainnet={mainnet}
                  />
                  {index === arr.length - 1 ? null : ',\u00a0'}
                </span>
              ))}

            {item.expenses.length === 0 && item.amount && new BigNumber(item.amount).isGreaterThan(0) ? (
              <OperationVolumeDisplay volume={item.amount!} mainnet={mainnet} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

type OperationArgumentDisplayProps = {
  i18nKey: TProps['id'];
  arg: string[];
};

const OperationArgumentDisplay = memo<OperationArgumentDisplayProps>(({ i18nKey, arg }) => (
  <T
    id={i18nKey}
    substitutions={
      <>
        {arg.map((value, index) => (
          <span key={index} className="flex">
            &nbsp;
            <HashChip key={index} hash={value} type="button" small trim />
            {index === arg.length - 1 ? null : ','}
          </span>
        ))}
      </>
    }
  />
));

type OperationVolumeDisplayProps = {
  expense?: OperationAssetExpense;
  volume?: number;
  withdrawal?: boolean;
  mainnet?: boolean;
};

const OperationVolumeDisplay = memo<OperationVolumeDisplayProps>(({ expense, volume, mainnet }) => {
  const metadata = useAssetMetadata(expense?.assetSlug ?? MAV_TOKEN_SLUG);

  const finalVolume = expense ? expense.amount.div(10 ** (metadata?.decimals || 0)) : volume;

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-white flex items-center">
        {/* {withdrawal && "-"} */}
        <span>
          <Money>{finalVolume || 0}</Money>
        </span>
        <span className="ml-1">{getAssetSymbol(metadata, true)}</span>
      </span>

      {expense?.assetSlug && (
        <InFiat volume={finalVolume || 0} assetSlug={expense.assetSlug} mainnet={mainnet} smallFractionFont={false}>
          {({ balance, symbol }) => (
            <div className="text-xs text-secondary-white flex items-baseline">
              (≈ <span className="mr-px">&nbsp;{symbol}</span>
              {balance})
            </div>
          )}
        </InFiat>
      )}
    </div>
  );
});
