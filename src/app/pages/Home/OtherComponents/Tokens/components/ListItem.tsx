import React, { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { AssetIcon } from 'app/templates/AssetIcon';
import { setAnotherSelector } from 'lib/analytics';
import { isTzbtcAsset } from 'lib/assets';
import { useAssetMetadata, getAssetName, getAssetSymbol } from 'lib/metadata';

import { AssetsSelectors } from '../../Assets.selectors';
import styles from '../Tokens.module.css';
import { CryptoBalance, FiatBalance } from './Balance';

interface Props {
  active: boolean;
  assetSlug: string;
  balance: BigNumber;
  onClick: (assetSlug: string) => void;
}

export const ListItem = memo<Props>(
  ({ active, assetSlug, balance, onClick }) => {
    const metadata = useAssetMetadata(assetSlug);

    const classNameMemo = useMemo(
      () =>
        classNames(
          'relative block w-full overflow-hidden flex items-center px-4 py-3 rounded',
          'hover:bg-primary-card',
          active && 'focus:bg-gray-200',
          styles.listItem
        ),
      [active]
    );

    if (metadata == null) return null;

    const assetSymbol = getAssetSymbol(metadata);
    const assetName = getAssetName(metadata);
    const isTzBTC = isTzbtcAsset(assetSlug);

    return (
      <div className={classNameMemo} {...setAnotherSelector('name', assetName)} onClick={() => onClick(assetSlug)}>
        <AssetIcon assetSlug={assetSlug} size={44} className="mr-2 flex-shrink-0" />

        <div className={classNames('w-full', styles.tokenInfoWidth)}>
          <div className="flex justify-between w-full mb-1">
            <div className="flex items-center flex-initial">
              <div className={styles['tokenSymbol']}>{assetSymbol}</div>
            </div>
            <CryptoBalance
              value={balance}
              cryptoDecimals={isTzBTC ? metadata.decimals : undefined}
              testID={AssetsSelectors.assetItemCryptoBalanceButton}
              testIDProperties={{ assetSlug }}
            />
          </div>
          <div className="flex justify-between w-full mb-1">
            <div className="text-sm font-normal text-secondary-white truncate flex-1">{assetName}</div>
            <FiatBalance
              assetSlug={assetSlug}
              value={balance}
              testID={AssetsSelectors.assetItemFiatBalanceButton}
              testIDProperties={{ assetSlug }}
            />
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.active !== nextProps.active) {
      return false;
    }
    if (prevProps.assetSlug !== nextProps.assetSlug) {
      return false;
    }
    if (prevProps.balance.toFixed() !== nextProps.balance.toFixed()) {
      return false;
    }

    return true;
  }
);
