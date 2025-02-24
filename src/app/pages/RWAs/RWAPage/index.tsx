import React, { memo, useMemo } from 'react';

// import { isDefined } from '@rnw-community/shared';
import BigNumber from 'bignumber.js';
import clsx from 'clsx';
import { useDispatch } from 'react-redux';

import { Spinner, Divider, Identicon, Anchor } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import { useAppEnv } from 'app/env';
import { ReactComponent as ExternalLinkIcon } from 'app/icons/external-link.svg';
import PageLayout from 'app/layouts/PageLayout';
// import { AvatarBlock } from 'app/molecules/AvatarBlock/AvatarBlock';
import { loadCollectiblesDetailsActions } from 'app/store/collectibles/actions';
import { useRwaMetadataSelector } from 'app/store/rwas-metadata/selectors';
import { ActionsBlock } from 'app/templates/Actions';
import { useBalance } from 'lib/balances';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { T } from 'lib/i18n';
import { getAssetName, TokenMetadata } from 'lib/metadata';
import { useAccount } from 'lib/temple/front';
import { useInterval } from 'lib/ui/hooks';
import { ZERO } from 'lib/utils/numbers';

import { addRandomDecimals } from '../utils';

import { CardWithLabel } from './CardWithLabel';
import { PropertiesItems } from './PropertiesItems';
import { RwaPageImage } from './RwaPageImage';

// icons

const DETAILS_SYNC_INTERVAL = 4 * BLOCK_DURATION;

interface Props {
  assetSlug: string;
}

export type TemporaryRwaType = {
  tokens: BigNumber;
  totalValue: string;
  estMarketPrice: string;
  lastSale: string;
  metadata: TokenMetadata | undefined;
};

const RWAPage = memo<Props>(({ assetSlug }) => {
  const { fullPage, popup } = useAppEnv();

  const { publicKeyHash } = useAccount();
  const metadata = useRwaMetadataSelector(assetSlug);
  const { value: balance = ZERO } = useBalance(assetSlug, publicKeyHash);

  const account = useAccount();

  const areDetailsLoading = false;

  const rwaName = getAssetName(metadata);

  const dispatch = useDispatch();
  useInterval(() => void dispatch(loadCollectiblesDetailsActions.submit([assetSlug])), DETAILS_SYNC_INTERVAL, [
    dispatch,
    assetSlug
  ]);

  const details: TemporaryRwaType = useMemo(
    () => ({
      tokens: balance,
      totalValue: '5.000.00',
      estMarketPrice: '50.00',
      lastSale: `${addRandomDecimals()}`,
      metadata
    }),
    [balance, metadata]
  );

  const CollectibleTextSection = () => (
    <div>
      <CopyButton
        text={rwaName}
        type={'block'}
        className={'text-white text-xl leading-6 tracking-tight text-left mb-2'}
      >
        {rwaName ?? 'NAME text #234'}
      </CopyButton>
      <div className="text-base-plus text-white break-words mb-4">
        Lorem ipsum dolor sit amet consectetur. Donec malesuada id fringilla maecenas at orci eu vel tellus. Ac arcu
        velit amet nascetur vestibulum consectetur sem. Facilisis dictumst leo eget sit eu. Ultricies ornare sed
        fringilla quis id sit. Turpis ut placerat leo convallis.
      </div>
    </div>
  );

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<span className="truncate">{rwaName}</span>}>
      <div className={clsx('flex flex-col w-full', !fullPage && 'pb-6')}>
        <div className={clsx(fullPage && 'grid grid-cols-2 items-start gap-x-4')}>
          <div
            className={clsx('relative rounded-2xl mb-6 bg-primary-card overflow-hidden')}
            style={{ aspectRatio: '1/1' }}
          >
            <RwaPageImage
              metadata={metadata}
              areDetailsLoading={false}
              objktArtifactUri={'ipfs://QmZxcWgVM7Kn4ohZ5Tw45GdS2wc1zih4EPKQr6iPZrLgS8'}
              isAdultContent={false}
              mime={null}
              className="h-full w-full"
            />
          </div>
          {fullPage && <CollectibleTextSection />}
        </div>

        <div className="w-full">
          <ActionsBlock assetSlug={assetSlug} />
        </div>

        {areDetailsLoading ? (
          <Spinner className="self-center w-20" />
        ) : (
          <>
            {!fullPage && <CollectibleTextSection />}

            <div>
              <div className={clsx('flex flex-col')}>
                <CardWithLabel cardContainerClassname={clsx(fullPage && 'min-h-16')} label={<T id={'rwaIssuer'} />}>
                  <div className="flex items-center gap-x-2">
                    <Identicon size={32} hash={'mv1Q3DyGiVYDrRj5PrUVQkTA1LHwYy8gHwQV'} className="rounded-full" />
                    <Anchor
                      href={`https://dev.equiteez.pages.dev/properties/${metadata?.address}`}
                      className="flex items-center gap-x-2"
                    >
                      <span>NextGen Real Estate</span>
                      <ExternalLinkIcon className="w-4 h-4 text-white fill-current" />
                    </Anchor>
                  </div>
                </CardWithLabel>
              </div>

              <Divider className="my-6" color="bg-divider" ignoreParent={!popup} />
              <PropertiesItems assetSlug={assetSlug} accountPkh={account.publicKeyHash} details={details} />
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
});

export default RWAPage;
