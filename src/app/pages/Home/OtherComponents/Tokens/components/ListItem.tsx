import React, { memo, useMemo } from 'react';

import classNames from 'clsx';

import { AddBanner, DelegatePeriodBanner } from 'app/atoms/AddBanner';
import { useAppEnv } from 'app/env';
import { AssetIcon } from 'app/templates/AssetIcon';
import { setAnotherSelector } from 'lib/analytics';
import { isTzbtcAsset, MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { getAssetName, getAssetSymbol } from 'lib/metadata';
import { useDelegate } from 'lib/temple/front';
import { ZERO } from 'lib/utils/numbers';

import { AssetsSelectors } from '../../Assets.selectors';
import styles from '../Tokens.module.css';

import { CryptoBalance, FiatBalance } from './Balance';

interface Props {
  onClick: (assetSlug: string) => void;
  publicKeyHash: string;
  assetSlug: string;
  active: boolean;
  scam?: boolean;
}

export const ListItem = memo<Props>(({ active, assetSlug, publicKeyHash, onClick }) => {
  const { popup } = useAppEnv();
  const { value: balance = ZERO, assetMetadata: metadata } = useBalance(assetSlug, publicKeyHash);
  const { data: accStats } = useDelegate(publicKeyHash);
  const myBakerPkh = accStats?.delegate?.address ?? null;

  const classNameMemo = useMemo(
    () =>
      classNames(
        'relative block w-full overflow-hidden flex items-center py-3 rounded',
        'hover:bg-primary-card',
        'px-4',
        active && 'focus:bg-gray-200',
        styles.listItem
      ),
    [active]
  );

  if (metadata == null) return null;

  const isMavToken = assetSlug === MAV_TOKEN_SLUG;
  const assetSymbol = getAssetSymbol(metadata);
  const assetName = getAssetName(metadata);
  const isTzBTC = isTzbtcAsset(assetSlug);
  const isDelegated = isMavToken && myBakerPkh;

  return (
    <div className={classNameMemo} {...setAnotherSelector('name', assetName)} onClick={() => onClick(assetSlug)}>
      <AssetIcon assetSlug={assetSlug} size={44} className="mr-2 flex-shrink-0" />

      <div className={classNames('w-full')} style={{ maxWidth: popup ? '19rem' : 'auto' }}>
        <div className="flex justify-between w-full mb-1">
          <div className="flex items-center flex-initial">
            <div className={styles['tokenSymbol']}>{assetSymbol}</div>
            {isDelegated && <DelegatePeriodBanner />}
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
});
