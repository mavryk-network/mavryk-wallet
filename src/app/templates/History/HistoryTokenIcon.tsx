import React, { FC } from 'react';

import { t } from 'lib/i18n';
import { AssetMetadataBase, useAssetMetadata } from 'lib/metadata';
import { UserHistoryItem } from 'lib/temple/history';
import { HistoryItemOpTypeEnum } from 'lib/temple/history/types';

type HistoryTokenIconProps = {
  onClick?: () => void;
  transactionType?: HistoryItemOpTypeEnum;
  slug: string;
  size?: number;
};

export const HistoryTokenIcon: FC<HistoryTokenIconProps> = ({ slug, transactionType, onClick, size = 32 }) => {
  const tokenMetadata = useAssetMetadata(slug ?? '');

  return (
    <div
      className="bg-primary-bg rounded-full flex items-center justify-center"
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      {tokenMetadata?.thumbnailUri ? (
        <>
          <img
            className="rounded-full"
            style={{ width: size, height: size }}
            src={tokenMetadata?.thumbnailUri}
            alt={tokenMetadata?.name}
          />
        </>
      ) : (
        <div className="text-white text-xs">{tokenMetadata?.name ?? t('unknown')}</div>
      )}
    </div>
  );
};
