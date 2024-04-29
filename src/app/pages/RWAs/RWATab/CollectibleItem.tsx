import React, { memo, useRef, useMemo, FC } from 'react';

import { isDefined } from '@rnw-community/shared';
import clsx from 'clsx';

import { Divider } from 'app/atoms';
import Money from 'app/atoms/Money';
import { useAppEnv } from 'app/env';
import { useBalanceSelector } from 'app/store/balances/selectors';
import {
  useAllCollectiblesDetailsLoadingSelector,
  useCollectibleDetailsSelector
} from 'app/store/collectibles/selectors';
import { useCollectibleMetadataSelector } from 'app/store/collectibles-metadata/selectors';
import { T } from 'lib/i18n';
import { getAssetName } from 'lib/metadata';
import { atomsToTokens } from 'lib/temple/helpers';
import { Link } from 'lib/woozie';

import { getDetailsListing } from '../utils';

import { CollectibleItemImage } from './CollectibleItemImage';
import { mockedRWAMetadata } from './rwa.mock';

interface Props {
  assetSlug: string;
  accountPkh: string;
  areDetailsShown: boolean;
  chainId: string;
}

export const CollectibleItem = memo<Props>(({ assetSlug, chainId, accountPkh, areDetailsShown }) => {
  const { popup } = useAppEnv();
  // const metadata = useCollectibleMetadataSelector(assetSlug);
  const metadata = mockedRWAMetadata;
  const toDisplayRef = useRef<HTMLDivElement>(null);
  const balanceAtomic = useBalanceSelector(accountPkh, chainId, assetSlug);

  const decimals = metadata?.decimals;

  const areDetailsLoading = useAllCollectiblesDetailsLoadingSelector();
  const details = useCollectibleDetailsSelector(assetSlug);

  const assetName = getAssetName(metadata);

  return (
    <div className="relative overflow-x-hidden">
      <Link to={`/nft/${assetSlug}`} className="relative flex gap-x-4 items-center rounded-2xl max-w-full">
        <div
          ref={toDisplayRef}
          className={clsx(
            'relative flex items-center justify-center bg-gray-405 rounded-lg overflow-hidden hover:opacity-70'
          )}
          style={{ width: 59, height: 59 }}
          title={assetName}
        >
          <CollectibleItemImage
            assetSlug={assetSlug}
            metadata={metadata}
            areDetailsLoading={areDetailsLoading && details === undefined}
            mime={details?.mime}
            // TODO add adult blur logic
            adultBlur={false}
            containerElemRef={toDisplayRef}
          />
        </div>

        <div className={clsx('mt-2 mb-2 flex flex-col items-start')}>
          <div
            className={clsx(
              'text-base-plus text-white overflow-x-auto truncate w-full mb-2',
              popup ? 'max-w-64' : 'max-w-96'
            )}
          >
            {assetName}
          </div>
          <div className="flex gap-x-6 items-start">
            <RWATableItem label="tokens" value="100" />
            <RWATableItem label="last sale" value="$50.00" />
            <RWATableItem label="total value" value="$5,000.00" />
          </div>
        </div>
      </Link>
      <Divider color="bg-divider" ignoreParent={!popup} />
    </div>
  );
});

type RWATableItemProps = {
  label: string;
  value: string;
};

const RWATableItem: FC<RWATableItemProps> = ({ label, value }) => {
  return (
    <section className="flex flex-col gap-y-2 justify-start text-sm">
      <div className="text-secondary-white capitalize">{label}</div>
      <div className="text-white">{value}</div>
    </section>
  );
};
