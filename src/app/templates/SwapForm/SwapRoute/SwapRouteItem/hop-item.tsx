import React, { FC } from 'react';

import { isDefined } from '@rnw-community/shared';
import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import { AssetIcon } from 'app/templates/AssetIcon';
import { Route3Dex } from 'lib/apis/route3/fetch-route3-dexes';
import { Route3Token } from 'lib/apis/route3/fetch-route3-tokens';
import { toTokenSlug, MAV_TOKEN_SLUG } from 'lib/assets';
import { getDexName } from 'lib/route3/utils/get-dex-name';
import { DexTypeIcon } from 'lib/swap-router';
import useTippy from 'lib/ui/useTippy';

interface Props {
  dex: Route3Dex | undefined;
  aToken: Route3Token | undefined;
  bToken: Route3Token | undefined;
  className?: string;
}

export const HopItem: FC<Props> = ({ dex, aToken, bToken, className }) => {
  const { popup } = useAppEnv();

  const dexInfoDivRef = useTippy<HTMLDivElement>({
    trigger: 'mouseenter',
    hideOnClick: false,
    content: `Dex: ${getDexName(dex?.type)}`,
    animation: 'shift-away-subtle'
  });
  const tokenAInfoDivRef = useTippy<HTMLDivElement>({
    trigger: 'mouseenter',
    hideOnClick: false,
    content: `${aToken?.symbol}`,
    animation: 'shift-away-subtle'
  });
  const tokenBInfoDivRef = useTippy<HTMLDivElement>({
    trigger: 'mouseenter',
    hideOnClick: false,
    content: `${bToken?.symbol}`,
    animation: 'shift-away-subtle'
  });

  return (
    <div
      className={classNames(
        className,
        'flex items-center p-1 border border-divider rounded-lg bg-primary-bg max-w-19 max-h-9'
      )}
    >
      <div ref={dexInfoDivRef} className="max-w-6 max-h-6 rounded-full overflow-hidden">
        <DexTypeIcon dexType={dex?.type ?? null} />
      </div>
      <div className={classNames('flex items-center', popup ? 'ml-1' : 'ml-2')}>
        <div ref={tokenAInfoDivRef}>
          <AssetIcon
            assetSlug={toAssetSlugLocal(aToken)}
            size={20}
            className="max-w-5 max-h-5 rounded-full overflow-hidden"
          />
        </div>
        <div ref={tokenBInfoDivRef} style={{ marginLeft: -8 }}>
          <AssetIcon
            assetSlug={toAssetSlugLocal(bToken)}
            size={20}
            className="max-w-5 max-h-5 rounded-full overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
};

const toAssetSlugLocal = (asset: Route3Token | nullish) => {
  if (!isDefined(asset)) return '';

  if (!isDefined(asset.contract)) return MAV_TOKEN_SLUG;

  return toTokenSlug(asset.contract, asset.tokenId ?? undefined);
};
