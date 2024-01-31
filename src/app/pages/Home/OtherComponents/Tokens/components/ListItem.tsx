import React, { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { useTokenApyInfo } from 'app/hooks/use-token-apy.hook';
import { AssetIcon } from 'app/templates/AssetIcon';
import { setAnotherSelector } from 'lib/analytics';
import { useAssetMetadata, getAssetName, getAssetSymbol } from 'lib/metadata';
import { Link } from 'lib/woozie';

import { AssetsSelectors } from '../../Assets.selectors';
import styles from '../Tokens.module.css';
import { toExploreAssetLink } from '../utils';
import { CryptoBalance, FiatBalance } from './Balance';
import { TokenTag } from './TokenTag';

interface Props {
  active: boolean;
  assetSlug: string;
  balance: BigNumber;
  onClick: (assetSlug: string) => void;
}

export const ListItem = memo<Props>(
  ({ active, assetSlug, balance, onClick }) => {
    const metadata = useAssetMetadata(assetSlug);

    // const apyInfo = useTokenApyInfo(assetSlug);

    const classNameMemo = useMemo(
      () =>
        classNames(
          'relative block w-full overflow-hidden flex items-center px-4 py-3 rounded',
          'hover:bg-primary-card transition ease-in-out duration-200 focus:outline-none',
          active && 'focus:bg-gray-200',
          styles.listItem
        ),
      [active]
    );

    if (metadata == null) return null;

    const assetSymbol = getAssetSymbol(metadata);
    const assetName = getAssetName(metadata);

    return (
      <div
        // to={toExploreAssetLink(assetSlug)}
        className={classNameMemo}
        // testID={AssetsSelectors.assetItemButton}
        // testIDProperties={{ key: assetSlug }}
        {...setAnotherSelector('name', assetName)}
        onClick={() => onClick(assetSlug)}
      >
        <AssetIcon assetSlug={assetSlug} size={44} className="mr-2 flex-shrink-0" />

        <div className={classNames('w-full', styles.tokenInfoWidth)}>
          <div className="flex justify-between w-full mb-1">
            <div className="flex items-center flex-initial">
              <div className={styles['tokenSymbol']}>{assetSymbol}</div>
              {/* <TokenTag assetSlug={assetSlug} assetSymbol={assetSymbol} apyInfo={apyInfo} /> */}
            </div>
            <CryptoBalance
              value={balance}
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
