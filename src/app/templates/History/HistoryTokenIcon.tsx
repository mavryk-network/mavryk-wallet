import React, { FC } from 'react';

import clsx from 'clsx';

import { ReactComponent as InteractIcon } from 'app/icons/operations/interact.svg';
import { ReactComponent as OriginateIcon } from 'app/icons/operations/originate.svg';
import { ReactComponent as OtherIcon } from 'app/icons/operations/other.svg';
import { ReactComponent as StakeIcon } from 'app/icons/operations/stake.svg';
import { ReactComponent as SwapIcon } from 'app/icons/operations/swap.svg';
import { ReactComponent as ReceiveIcon } from 'app/icons/operations/transfer-from.svg';
import { ReactComponent as SendIcon } from 'app/icons/operations/transfer-to.svg';
// import { ReactComponent as WithdrawIcon } from 'app/icons/operations/withdraw.svg';
import { useMultipleAssetsMetadata } from 'lib/metadata';
import { HistoryItemOpTypeEnum, UserHistoryItem } from 'lib/temple/history/types';

import { alterIpfsUrl, getAssetsFromOperations } from './utils';

/**
 * onClick - open modal for tx item
 * historyitem - the actual histiry item
 * size - icon size
 * limit - nunmber of assets to show if it's swap
 */
type HistoryTokenIconProps = {
  onClick?: () => void;
  historyItem: UserHistoryItem;
  size?: number;
  limit?: number;
};

export const HistoryTokenIcon: FC<HistoryTokenIconProps> = ({ historyItem, onClick, size = 32, limit = 2 }) => {
  const { type } = historyItem;
  const slugs = getAssetsFromOperations(historyItem);
  const tokensMetadata = useMultipleAssetsMetadata(slugs);

  const renderOperationIcon = () => {
    // TODO add withdraw. new stake, vote yay, buy
    switch (type) {
      case HistoryItemOpTypeEnum.TransferFrom:
        return <ReceiveIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.TransferTo:
        return <SendIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.Delegation:
        return <StakeIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.Swap:
        return <SwapIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.Origination:
        return <OriginateIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.Interaction:
        return <InteractIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.Reveal:
      case HistoryItemOpTypeEnum.Other:
        return <OtherIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;

      default:
        return (
          <div
            className="rounded-full overflow-hidden border-2 border-accent-blue"
            style={{ width: size, height: size }}
          />
        );
    }
  };

  return (
    <div
      className={clsx(
        'h-12 flex items-center justify-start',
        slugs.length === 1 && 'w-11',
        limit === 2 && slugs.length > 1 && 'w-13'
      )}
    >
      <div
        className="bg-primary-bg rounded-full flex items-center justify-center relative"
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        {renderOperationIcon()}
        {tokensMetadata?.slice(0, limit)?.map((token, idx, arr) => (
          <img
            key={idx}
            className={clsx('rounded-full overflow-hidden w-6 h-6 absolute top-1/2 bg-white')}
            style={{
              left: `${getLeftImagePosition(idx)}%`,
              zIndex: arr.length - idx
            }}
            src={alterIpfsUrl(token?.thumbnailUri)}
            alt={token?.name}
          />
        ))}
      </div>
    </div>
  );
};

function getLeftImagePosition(idx: number) {
  if (idx === 0) return 60;

  return 60 + idx * 30;
}
