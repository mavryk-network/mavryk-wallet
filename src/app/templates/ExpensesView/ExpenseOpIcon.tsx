import React, { FC, useMemo } from 'react';

import clsx from 'clsx';

import { ReactComponent as InteractIcon } from 'app/icons/operations/interact.svg';
import { ReactComponent as OriginateIcon } from 'app/icons/operations/originate.svg';
import { ReactComponent as StakeIcon } from 'app/icons/operations/stake.svg';
import { ReactComponent as SendIcon } from 'app/icons/operations/transfer-to.svg';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useMultipleAssetsMetadata } from 'lib/metadata';
import { getLeftImagePosition } from 'lib/utils/token-icon';

import { AssetIconPlaceholder } from '../AssetIcon';
import { AssetImage } from '../AssetImage';

import { OperationExpenses } from './ExpensesView';

type ExpenseOpIconProps = {
  size: number;
  item: OperationExpenses;
};

const getExpenseAssets = (expenses: OperationExpenses['expenses'], type: string) => {
  if (type === 'delegation') return [MAV_TOKEN_SLUG];
  const slugsRecord = expenses.reduce<Record<string, number>>((acc, item) => {
    const key = item?.assetSlug ?? MAV_TOKEN_SLUG;
    acc[key] = acc[key] ? acc[key] + 1 : 0;

    return acc;
  }, {});

  return Object.keys(slugsRecord);
};

export const ExpenseOpIcon: FC<ExpenseOpIconProps> = ({ item, size }) => {
  const { type, expenses } = item;
  const assetSlugs = getExpenseAssets(expenses, type);
  const tokensMetadata = useMultipleAssetsMetadata(assetSlugs);

  const renderOperationIcon = () => {
    // TODO add withdraw. new stake, vote yay, buy
    switch (type) {
      case 'transaction':
      case 'transfer':
        return <SendIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case 'delegation':
        return <StakeIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case 'approve':
        return <OriginateIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;

      default:
        return <InteractIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
    }
  };

  const memoizedPxDistance = useMemo(() => {
    // single operation icon type
    if (!tokensMetadata) return 16;

    // operation with only one asset (f.e. send, stake)
    if (tokensMetadata.length === 1) return 16;

    // interaction, swap etc. types
    return tokensMetadata.length * 8 + size * 0.1;
  }, [tokensMetadata, size]);

  return (
    <div
      className={clsx('bg-primary-bg rounded-full flex items-center justify-center relative')}
      style={{ width: size, height: size, marginRight: memoizedPxDistance }}
    >
      {renderOperationIcon()}
      {tokensMetadata &&
        tokensMetadata.map((token, idx, arr) => {
          const baseProps = {
            className: clsx('rounded-full overflow-hidden absolute top-1/2', arr.length > 1 ? 'w-4 h-4' : 'w-6 h-6'),
            style: {
              left: `${getLeftImagePosition(idx)}%`,
              zIndex: arr.length - idx
            }
          };

          return (
            <AssetImage
              key={idx}
              {...baseProps}
              metadata={token}
              loader={<AssetIconPlaceholder size={24} {...baseProps} metadata={token} />}
              fallback={<AssetIconPlaceholder size={24} {...baseProps} metadata={token} />}
            />
          );
        })}
    </div>
  );
};
