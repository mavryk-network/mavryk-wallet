import React, { memo, useMemo } from 'react';

import classNames from 'clsx';

import { DelegatePeriodBanner } from 'app/atoms/AddBanner';
import { useAppEnv } from 'app/env';
import { AssetIcon } from 'app/templates/AssetIcon';
import { setAnotherSelector } from 'lib/analytics';
import { isTzbtcAsset, MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { T } from 'lib/i18n';
import { getAssetName, getAssetSymbol, MAVEN_METADATA } from 'lib/metadata';
import { useDelegate } from 'lib/temple/front';
import { atomsToTokens } from 'lib/temple/helpers';
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

  const { delegatedBalance, stakedBalance } = useMemo(() => {
    const stakedBalance = accStats?.stakedBalance ?? ZERO;
    const unstakedBalance = accStats?.unstakedBalance ?? ZERO;

    return {
      delegatedBalance: balance,
      stakedBalance: atomsToTokens(stakedBalance === 0 ? unstakedBalance : stakedBalance, metadata?.decimals ?? 6)
    };
  }, [accStats?.stakedBalance, accStats?.unstakedBalance, balance, metadata?.decimals]);

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

  const isMavToken = assetSlug === MAV_TOKEN_SLUG;
  const assetSymbol = getAssetSymbol(metadata);
  const assetName = getAssetName(metadata);
  const isTzBTC = isTzbtcAsset(assetSlug);
  const isDelegated = isMavToken && myBakerPkh;

  const additionalDelegateBlock = useMemo(() => {
    const rows: { Column1: React.ReactNode; Column2: React.ReactNode }[] = [];

    if (isDelegated && !delegatedBalance.isZero()) {
      rows.push({
        Column1: (
          <div className="text-sm font-normal text-secondary-white truncate flex-1">
            <T id="delegated" />
          </div>
        ),
        Column2: (
          <CryptoBalance value={delegatedBalance} cryptoDecimals={metadata?.decimals ?? MAVEN_METADATA.decimals} />
        )
      });
    }

    if (stakedBalance && !stakedBalance.isZero()) {
      rows.push({
        Column1: (
          <div className="text-sm font-normal text-secondary-white truncate flex-1">
            <T id="coStaked" />
          </div>
        ),
        Column2: <CryptoBalance value={stakedBalance} cryptoDecimals={metadata?.decimals ?? MAVEN_METADATA.decimals} />
      });
    }

    return rows.length > 0 ? rows : null;
  }, [isDelegated, stakedBalance, delegatedBalance, metadata?.decimals]);

  if (metadata == null) return null;

  return (
    <div className={classNameMemo} {...setAnotherSelector('name', assetName)} onClick={() => onClick(assetSlug)}>
      <AssetIcon assetSlug={assetSlug} size={44} className="mr-2 flex-shrink-0 self-start" />

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
          <div className="flex flex-col items-start gap-1">
            <div className="text-sm font-normal text-secondary-white truncate flex-1">{assetName}</div>
            {additionalDelegateBlock?.map((row, i) => (
              <div key={i} className={classNames(i === 0 && 'mt-1')}>
                {row.Column1}
              </div>
            ))}
          </div>
          <div className="flex flex-col items-end gap-1">
            <FiatBalance
              assetSlug={assetSlug}
              value={balance}
              testID={AssetsSelectors.assetItemFiatBalanceButton}
              testIDProperties={{ assetSlug }}
            />
            {additionalDelegateBlock?.map((row, i) => (
              <div key={i} className={classNames(i === 0 && 'mt-1')}>
                {row.Column2}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
