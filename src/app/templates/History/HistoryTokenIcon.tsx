import React, { FC } from 'react';

import clsx from 'clsx';

import { ReactComponent as StakeIcon } from 'app/icons/operations/stake.svg';
import { ReactComponent as SwapIcon } from 'app/icons/operations/swap.svg';
import { ReactComponent as ReceiveIcon } from 'app/icons/operations/transfer-from.svg';
import { ReactComponent as SendIcon } from 'app/icons/operations/transfer-to.svg';
import { ReactComponent as WithdrawIcon } from 'app/icons/operations/withdraw.svg';
import { TEZ_TOKEN_SLUG, isTezAsset, toTokenSlug } from 'lib/assets';
import { useMultipleAssetsMetadata } from 'lib/metadata';
import { HistoryItemOpTypeEnum, HistoryItemTransactionOp, UserHistoryItem } from 'lib/temple/history/types';

import { alterIpfsUrl, toHistoryTokenSlug } from './utils';

type HistoryTokenIconProps = {
  onClick?: () => void;
  historyItem: UserHistoryItem;
  size?: number;
};

function getAssetsFromOperations(item: UserHistoryItem | null) {
  if (!item || item.operations.length === 1) return [toHistoryTokenSlug(item)];

  const slugs = item.operations.reduce<string[]>((acc, op) => {
    const tokenId = (op as HistoryItemTransactionOp).tokenTransfers?.tokenId ?? 0;

    const assetSlug = op.contractAddress
      ? isTezAsset(op.contractAddress)
        ? TEZ_TOKEN_SLUG
        : toTokenSlug(op.contractAddress, tokenId)
      : '';
    acc = [...new Set([...acc, assetSlug].filter(o => Boolean(o)))];
    return acc;
  }, []);

  return slugs;
}

export const HistoryTokenIcon: FC<HistoryTokenIconProps> = ({ historyItem, onClick, size = 32 }) => {
  const { type } = historyItem;
  const slugs = getAssetsFromOperations(historyItem);
  const tokensMetadata = useMultipleAssetsMetadata(slugs);

  const renderOperationIcon = () => {
    // TODO add other icons
    switch (type) {
      case HistoryItemOpTypeEnum.TransferFrom:
        return <ReceiveIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.TransferTo:
        return <SendIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.Delegation:
        return <StakeIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.Swap:
        return <SwapIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;
      case HistoryItemOpTypeEnum.Interaction:
        return <WithdrawIcon className="rounded-full overflow-hidden" style={{ width: size, height: size }} />;

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
    <div className="w-13 h-12 flex items-center justify-start">
      <div
        className="bg-primary-bg rounded-full flex items-center justify-center relative"
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        {renderOperationIcon()}
        {tokensMetadata?.map((token, idx, arr) => (
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
