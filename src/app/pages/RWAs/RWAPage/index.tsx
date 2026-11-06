import React, { memo } from 'react';

// import { isDefined } from '@rnw-community/shared';
import clsx from 'clsx';

import { Spinner, Alert, Divider, Identicon, Anchor } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import { useAppEnv } from 'app/env';
import { ReactComponent as ExternalLinkIcon } from 'app/icons/external-link.svg';
import PageLayout from 'app/layouts/PageLayout';
// import { AvatarBlock } from 'app/molecules/AvatarBlock/AvatarBlock';
import { useRwaMetadataSelector } from 'app/store/rwas-metadata/selectors';
import { ActionsBlock } from 'app/templates/Actions';
import { fromAssetSlug } from 'lib/assets/utils';
import { useBalance } from 'lib/balances';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { T, t } from 'lib/i18n';
import {
  useRwaDetails,
  useAreRwaDetailsLoading,
  useRwaDetailPageBatch,
  useRwaDetailsError
} from 'lib/rwas/use-rwas-details.query';
import { useAccount } from 'lib/temple/front';
import { ZERO } from 'lib/utils/numbers';

import { CardWithLabel } from './CardWithLabel';
import { PropertiesItems } from './PropertiesItems';
import { RwaPageImage } from './RwaPageImage';

const DETAILS_SYNC_INTERVAL = 4 * BLOCK_DURATION;

interface Props {
  assetSlug: string;
}

const RWAPage = memo<Props>(({ assetSlug }) => {
  const detailsError = useRwaDetailsError();
  const { fullPage, popup } = useAppEnv();

  const { publicKeyHash } = useAccount();
  const metadata = useRwaMetadataSelector(assetSlug);
  const rwaDetails = useRwaDetails(assetSlug);
  const { value: balance = ZERO } = useBalance(assetSlug, publicKeyHash);
  const [address] = fromAssetSlug(assetSlug);

  const account = useAccount();

  const isBatchLoading = useAreRwaDetailsLoading();
  const areDetailsLoading = isBatchLoading && rwaDetails === undefined;

  useRwaDetailPageBatch(assetSlug, DETAILS_SYNC_INTERVAL);

  const name = rwaDetails?.name ?? '--';
  const description = rwaDetails?.description?.trim();

  const CollectibleTextSection = () => (
    <div className="mb-4">
      <CopyButton text={name} type={'block'} className={'text-white text-xl leading-6 tracking-tight text-left mb-2'}>
        {name}
      </CopyButton>
      {description && <div className="text-base-plus text-white break-words">{description}</div>}
    </div>
  );

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<span className="truncate">{name}</span>}>
      <div className={clsx('flex flex-col w-full', !fullPage && 'pb-6')}>
        {detailsError && <Alert type="error" title={t('error')} description={t('unknownError')} className="mb-4" />}
        <div className={clsx(fullPage && 'grid grid-cols-1 items-start gap-x-4')}>
          <div
            className={clsx('relative rounded-2xl mb-6 bg-primary-card overflow-hidden')}
            style={{ aspectRatio: '1/1' }}
          >
            <RwaPageImage
              metadata={metadata}
              areDetailsLoading={areDetailsLoading}
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
              <PropertiesItems
                assetSlug={assetSlug}
                accountPkh={account.publicKeyHash}
                balance={balance}
                symbol={metadata?.symbol}
                details={rwaDetails}
              />
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
});

export default RWAPage;
