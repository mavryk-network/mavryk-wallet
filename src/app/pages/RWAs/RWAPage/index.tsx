import React, { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import clsx from 'clsx';

import { Spinner, Divider, Identicon, Anchor } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import { useAppEnv } from 'app/env';
import { ReactComponent as ExternalLinkIcon } from 'app/icons/external-link.svg';
import PageLayout from 'app/layouts/PageLayout';
import { ActionsBlock } from 'app/templates/Actions';
import { CardWithLabel } from 'app/templates/CardWithLabel';
import { AssetPageImage } from 'app/templates/CollectibleMedia';
import { fromAssetSlug } from 'lib/assets/utils';
import { useBalance } from 'lib/balances';
import { T } from 'lib/i18n';
import { TokenMetadata } from 'lib/metadata';
import { useRwaDetails, useRwasDetailsQuery } from 'lib/rwas/use-rwas-details.query';
import { useRwaMetadataSelector } from 'lib/store/zustand/metadata.store';
import { useAccount } from 'lib/temple/front';
import { ZERO } from 'lib/utils/numbers';

import { RwaImageFallback } from '../components/CollectibleImageFallback';
import { LOCAL_STORAGE_ADULT_BLUR_TOGGLE_KEY } from '../constants';

import { PropertiesItems } from './PropertiesItems';

interface Props {
  assetSlug: string;
}

export type RwaDetailsDisplay = {
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
  const rwaDetails = useRwaDetails(assetSlug);
  const { value: balance = ZERO } = useBalance(assetSlug, publicKeyHash);
  const [address] = fromAssetSlug(assetSlug);

  const account = useAccount();

  const areDetailsLoading = false;

  // TanStack Query handles fetching + refetch interval automatically
  useRwasDetailsQuery([assetSlug]);

  const details: RwaDetailsDisplay = useMemo(
    () => ({
      tokens: balance,
      totalValue: '--',
      estMarketPrice: '--',
      lastSale: '--',
      metadata
    }),
    [balance, metadata]
  );

  const name = rwaDetails?.name ?? '--';

  const CollectibleTextSection = () => (
    <div>
      <CopyButton text={name} type={'block'} className={'text-white text-xl leading-6 tracking-tight text-left mb-2'}>
        {name}
      </CopyButton>
      <div className="text-base-plus text-white break-words mb-4">{rwaDetails?.description ?? '--'}</div>
    </div>
  );

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<span className="truncate">{name}</span>}>
      <div className={clsx('flex flex-col w-full', !fullPage && 'pb-6')}>
        <div className={clsx(fullPage && 'grid grid-cols-1 items-start gap-x-4')}>
          <div
            className={clsx('relative rounded-2xl mb-6 bg-primary-card overflow-hidden')}
            style={{ aspectRatio: '1/1' }}
          >
            <AssetPageImage
              metadata={metadata}
              areDetailsLoading={false}
              objktArtifactUri={'ipfs://QmZxcWgVM7Kn4ohZ5Tw45GdS2wc1zih4EPKQr6iPZrLgS8'}
              isAdultContent={false}
              mime={null}
              className="h-full w-full"
              fallback={<RwaImageFallback symbol={metadata?.symbol} large />}
              audioFallback={<RwaImageFallback large isAudioCollectible symbol={metadata?.symbol} />}
              adultBlurToggleKey={LOCAL_STORAGE_ADULT_BLUR_TOGGLE_KEY}
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
                    <Identicon size={32} hash={address} className="rounded-full" />
                    <Anchor
                      href={`https://nexus.mavryk.org/explorer/contract/${address}`}
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
