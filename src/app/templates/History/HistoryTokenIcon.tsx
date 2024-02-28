import React, { FC, useMemo } from 'react';

import { ReactComponent as StakeIcon } from 'app/icons/operations/stake.svg';
import { ReactComponent as SwapIcon } from 'app/icons/operations/swap.svg';
import { ReactComponent as ReceiveIcon } from 'app/icons/operations/transfer-from.svg';
import { ReactComponent as SendIcon } from 'app/icons/operations/transfer-to.svg';
import { ReactComponent as WithdrawIcon } from 'app/icons/operations/withdraw.svg';
import { t } from 'lib/i18n';
import { useAssetMetadata } from 'lib/metadata';
import { HistoryItemOpTypeEnum } from 'lib/temple/history/types';
import useTippy from 'lib/ui/useTippy';

import { alterIpfsUrl } from './utils';

type HistoryTokenIconProps = {
  onClick?: () => void;
  transactionType: HistoryItemOpTypeEnum;
  slug: string;
  size?: number;
};

export const HistoryTokenIcon: FC<HistoryTokenIconProps> = ({ slug, transactionType, onClick, size = 32 }) => {
  const tokenMetadata = useAssetMetadata(slug ?? '');

  const tippyProps = useMemo(
    () => ({
      trigger: 'mouseenter',
      hideOnClick: false,
      content: tokenMetadata?.name ?? t('unknown'),
      animation: 'shift-away-subtle'
    }),
    [tokenMetadata?.name]
  );

  const ref = useTippy<HTMLImageElement>(tippyProps);

  const renderOperationIcon = () => {
    // TODO add other icons
    switch (transactionType) {
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
    <div className="w-13 h-12 flex items-center justify-center">
      <div
        className="bg-primary-bg rounded-full flex items-center justify-center relative"
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        {renderOperationIcon()}
        <img
          ref={ref}
          className="rounded-full overflow-hidden w-6 h-6 absolute left-2/3 top-1/2"
          src={alterIpfsUrl(tokenMetadata?.thumbnailUri)}
          alt={tokenMetadata?.name}
        />
      </div>
    </div>
  );
};
