import React, { memo, useCallback, useRef, useState, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import clsx from 'clsx';

import Money from 'app/atoms/Money';
import { useAppEnv } from 'app/env';
import {
  useAllCollectiblesDetailsLoadingSelector,
  useCollectibleDetailsSelector
} from 'app/store/collectibles/selectors';
import { useTokenMetadataSelector } from 'app/store/tokens-metadata/selectors';
import { T } from 'lib/i18n';
import { getAssetName } from 'lib/metadata';
import { useBalance } from 'lib/temple/front';
import { atomsToTokens } from 'lib/temple/helpers';
import { useIntersectionDetection } from 'lib/ui/use-intersection-detection';
import { Link } from 'lib/woozie';

import { getListingDetails } from '../utils';
import { NFTItemImage } from './NFTItemImage';

interface Props {
  assetSlug: string;
  accountPkh: string;
  areDetailsShown: boolean;
}

export const CollectibleItem = memo<Props>(({ assetSlug, accountPkh, areDetailsShown }) => {
  const { popup } = useAppEnv();
  const metadata = useTokenMetadataSelector(assetSlug);
  const toDisplayRef = useRef<HTMLDivElement>(null);
  const [displayed, setDisplayed] = useState(true);
  const { data: balance } = useBalance(assetSlug, accountPkh, { displayed, suspense: false });

  const areDetailsLoading = useAllCollectiblesDetailsLoadingSelector();
  const details = useCollectibleDetailsSelector(assetSlug);

  const listing = useMemo(() => getListingDetails(details), [details]);

  const handleIntersection = useCallback(() => void setDisplayed(true), []);

  useIntersectionDetection(toDisplayRef, handleIntersection, !displayed);

  const assetName = getAssetName(metadata);

  return (
    <Link to={`/collectible/${assetSlug}`} className="flex flex-col rounded-2xl">
      <div
        ref={toDisplayRef}
        className={clsx(
          'relative flex items-center justify-center bg-primary-card rounded-lg overflow-hidden hover:opacity-70',
          popup ? 'h-163px' : 'h-31.25'
        )}
        title={assetName}
      >
        {displayed && (
          <NFTItemImage
            assetSlug={assetSlug}
            metadata={metadata}
            areDetailsLoading={areDetailsLoading && details === undefined}
            mime={details?.mime}
          />
        )}

        {areDetailsShown && balance ? (
          <div className="absolute bottom-1.5 left-1.5 text-xxxs text-white leading-none p-1 bg-black bg-opacity-60 rounded">
            {balance.toFixed()}×
          </div>
        ) : null}
      </div>

      {areDetailsShown && (
        <div className="mt-2 mb-2 flex flex-col items-start">
          <div className="text-base-plus text-white overflow-x-auto truncate w-full">{assetName}</div>
          <div className="text-sm leading-3 text-white">
            <div className="mb-1 text-secondary-white mt-1">
              <T id="floorPrice" />:{' '}
            </div>
            <div>
              {isDefined(listing) ? (
                <>
                  <Money shortened smallFractionFont={false} tooltip={true}>
                    {atomsToTokens(listing.floorPrice, listing.decimals)}
                  </Money>
                  <span> {listing.symbol}</span>
                </>
              ) : (
                '-'
              )}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
});
