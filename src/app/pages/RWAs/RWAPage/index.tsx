import React, { memo, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import clsx from 'clsx';
import { useDispatch } from 'react-redux';

import { Spinner, Money, Alert, Divider, Identicon, Anchor } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import { useAppEnv } from 'app/env';
import { ReactComponent as ExternalLinkIcon } from 'app/icons/external-link.svg';
import PageLayout from 'app/layouts/PageLayout';
import { AvatarBlock } from 'app/molecules/AvatarBlock/AvatarBlock';
import { loadCollectiblesDetailsActions } from 'app/store/collectibles/actions';
import {
  useAllCollectiblesDetailsLoadingSelector,
  useCollectibleDetailsSelector
} from 'app/store/collectibles/selectors';
import { useRwaDetailsSelector } from 'app/store/rwas/selectors';
import { useTokenMetadataSelector } from 'app/store/tokens-metadata/selectors';
import { ActionsBlock } from 'app/templates/Actions';
import OperationStatus from 'app/templates/OperationStatus';
import { fetchCollectibleExtraDetails } from 'lib/apis/objkt';
import { fromAssetSlug } from 'lib/assets/utils';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { t, T } from 'lib/i18n';
import { getAssetName } from 'lib/metadata';
import { useRetryableSWR } from 'lib/swr';
import { useAccount } from 'lib/temple/front';
import { atomsToTokens } from 'lib/temple/helpers';
import { useInterval } from 'lib/ui/hooks';

import { useRwaSelling } from '../hooks/use-rwa-selling.hook';
import { mockedRWAMetadata, mockedRWASlug } from '../RWATab/rwa.mock';
import { getDetailsListing } from '../utils';

import { CardWithLabel } from './CardWithLabel';
import { PropertiesItems } from './PropertiesItems';
import { RwaPageImage } from './RwaPageImage';

// icons

const DETAILS_SYNC_INTERVAL = 4 * BLOCK_DURATION;

interface Props {
  assetSlug: string;
}

const RWAPage = memo<Props>(({ assetSlug = mockedRWASlug }) => {
  // const metadata = useCollectibleMetadataSelector(assetSlug);
  const metadata = useTokenMetadataSelector(assetSlug);
  const details = useRwaDetailsSelector(assetSlug) ?? mockedRWAMetadata;
  const areAnyNFTsDetailsLoading = useAllCollectiblesDetailsLoadingSelector();
  const { fullPage } = useAppEnv();

  // const [contractAddress, tokenId] = fromAssetSlug(assetSlug);

  // const { data: extraDetails } = useRetryableSWR(
  //   ['fetchCollectibleExtraDetails', contractAddress, tokenId],
  //   () => (tokenId ? fetchCollectibleExtraDetails(contractAddress, tokenId) : Promise.resolve(null)),
  //   {
  //     refreshInterval: DETAILS_SYNC_INTERVAL
  //   }
  // );

  const account = useAccount();

  const areDetailsLoading = areAnyNFTsDetailsLoading && details === undefined;

  const rwaName = getAssetName(metadata);

  const dispatch = useDispatch();
  useInterval(() => void dispatch(loadCollectiblesDetailsActions.submit([assetSlug])), DETAILS_SYNC_INTERVAL, [
    dispatch,
    assetSlug
  ]);

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
          <div className={clsx('rounded-2xl mb-6 bg-primary-card overflow-hidden')} style={{ aspectRatio: '1/1' }}>
            <RwaPageImage
              metadata={metadata}
              areDetailsLoading={areDetailsLoading}
              // @ts-expect-error
              objktArtifactUri={details?.displayUri}
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
                    <Anchor href={process.env.NODES_URL} className="flex items-center gap-x-2">
                      <span>NextGen Real Estate</span>
                      <ExternalLinkIcon className="w-4 h-4 text-white stroke-current" />
                    </Anchor>
                  </div>
                </CardWithLabel>
              </div>

              <Divider className="my-6" color="bg-divider" />
              <PropertiesItems assetSlug={assetSlug} accountPkh={account.publicKeyHash} details={details} />
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
});

export default RWAPage;
