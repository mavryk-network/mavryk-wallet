import React, { memo, useCallback, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import { useDispatch } from 'react-redux';

import { FormSubmitButton, Spinner, Money, Alert, Divider } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import PageLayout from 'app/layouts/PageLayout';
import { AvatarBlock } from 'app/molecules/AvatarBlock/AvatarBlock';
import {
  useAllCollectiblesDetailsLoadingSelector,
  useCollectibleDetailsSelector
} from 'app/store/collectibles/selectors';
import { useCollectibleMetadataSelector } from 'app/store/collectibles-metadata/selectors';
import { loadNFTsDetailsActions } from 'app/store/nfts/actions';
import OperationStatus from 'app/templates/OperationStatus';
import { fetchCollectibleExtraDetails, objktCurrencies } from 'lib/apis/objkt';
import { fromAssetSlug } from 'lib/assets/utils';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { t, T } from 'lib/i18n';
import { getAssetName } from 'lib/metadata';
import { useRetryableSWR } from 'lib/swr';
import { useAccount } from 'lib/temple/front';
import { atomsToTokens } from 'lib/temple/helpers';
import { TempleAccountType } from 'lib/temple/types';
import { useInterval } from 'lib/ui/hooks';
import { navigate } from 'lib/woozie';

import { useCollectibleSelling } from '../hooks/use-collectible-selling.hook';
import { CollectibleSelectors } from '../selectors';
import { getDetailsListing } from '../utils';

import { CardWithLabel } from './CardWithLabel';
import { CollectiblePageImage } from './CollectiblePageImage';
import { PropertiesItems } from './PropertiesItems';

const DETAILS_SYNC_INTERVAL = 4 * BLOCK_DURATION;

interface Props {
  assetSlug: string;
}

const CollectiblePage = memo<Props>(({ assetSlug }) => {
  const metadata = useCollectibleMetadataSelector(assetSlug);
  const details = useCollectibleDetailsSelector(assetSlug);
  const areAnyNFTsDetailsLoading = useAllCollectiblesDetailsLoadingSelector();

  const [contractAddress, tokenId] = fromAssetSlug(assetSlug);

  const { data: extraDetails } = useRetryableSWR(
    ['fetchCollectibleExtraDetails', contractAddress, tokenId],
    () => (tokenId ? fetchCollectibleExtraDetails(contractAddress, tokenId) : Promise.resolve(null)),
    {
      refreshInterval: DETAILS_SYNC_INTERVAL
    }
  );

  const account = useAccount();

  const offers = extraDetails?.offers_active;

  const { publicKeyHash } = account;
  const accountCanSign = account.type !== TempleAccountType.WatchOnly;

  const areDetailsLoading = areAnyNFTsDetailsLoading && details === undefined;

  const nftName = getAssetName(metadata);

  const creators = details?.creators ?? [];

  const takableOffer = useMemo(
    () => offers?.find(({ buyer_address }) => buyer_address !== publicKeyHash),
    [details, publicKeyHash]
  );

  const {
    isSelling,
    initiateSelling: onSellButtonClick,
    operation,
    operationError
  } = useCollectibleSelling(assetSlug, takableOffer);

  const onSendButtonClick = useCallback(() => navigate(`/send/${assetSlug}`), [assetSlug]);

  const dispatch = useDispatch();
  useInterval(() => void dispatch(loadNFTsDetailsActions.submit([assetSlug])), DETAILS_SYNC_INTERVAL, [
    dispatch,
    assetSlug
  ]);

  const displayedOffer = useMemo(() => {
    const highestOffer = offers?.[0];
    if (!isDefined(highestOffer)) return null;

    const offer = takableOffer ?? highestOffer;

    const buyerIsMe = offer.buyer_address === publicKeyHash;

    const currency = objktCurrencies[offer.currency_id];
    if (!isDefined(currency)) return null;

    const price = atomsToTokens(offer.price, currency.decimals);

    return { price, symbol: currency.symbol, buyerIsMe };
  }, [offers, takableOffer, publicKeyHash]);

  const sellButtonTooltipStr = useMemo(() => {
    if (!displayedOffer) return;
    if (displayedOffer.buyerIsMe) return t('cannotSellToYourself');

    let value = displayedOffer.price.toString();
    if (!accountCanSign) value += ` [${t('selectedAccountCannotSignTx')}]`;

    return value;
  }, [displayedOffer, accountCanSign]);

  const listing = getDetailsListing(details);

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<span className="truncate">{nftName}</span>}>
      <div className="flex flex-col w-full pb-6">
        {operationError ? (
          <Alert
            type="error"
            title={t('error')}
            description={operationError instanceof Error ? operationError.message : t('unknownError')}
            className="mb-4"
          />
        ) : (
          operation && <OperationStatus typeTitle={t('transaction')} operation={operation} className="mb-4" />
        )}

        <div className="rounded-2xl mb-6 bg-gray-405 overflow-hidden" style={{ aspectRatio: '1/1' }}>
          <CollectiblePageImage
            metadata={metadata}
            areDetailsLoading={areDetailsLoading}
            objktArtifactUri={details?.objktArtifactUri}
            isAdultContent={details?.isAdultContent}
            mime={details?.mime}
            className="h-full w-full"
          />
        </div>

        {areDetailsLoading ? (
          <Spinner className="self-center w-20" />
        ) : (
          <>
            <div className="flex gap-x-4 items-center w-full mb-4">
              <FormSubmitButton
                disabled={!displayedOffer || displayedOffer.buyerIsMe || isSelling || !accountCanSign}
                title={sellButtonTooltipStr}
                onClick={onSellButtonClick}
                testID={CollectibleSelectors.sellButton}
              >
                {displayedOffer ? <T id="sell" /> : <T id="noOffersYet" />}
              </FormSubmitButton>

              <FormSubmitButton
                disabled={isSelling}
                onClick={onSendButtonClick}
                testID={CollectibleSelectors.sendButton}
              >
                <T id="send" />
              </FormSubmitButton>
            </div>

            <CopyButton
              text={nftName}
              type={'block'}
              className={'text-white text-left text-xl leading-6 tracking-tight truncate mb-2'}
            >
              {nftName}
            </CopyButton>

            <div className="text-base-plus text-white break-words mb-4">{details?.description ?? ''}</div>

            <div>
              {creators.length > 0 && (
                <>
                  <CardWithLabel label={<T id={creators.length > 1 ? 'creators' : 'creator'} />} className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {creators.map((creator, idx) => (
                        <div key={creator.address} className="w-full">
                          <AvatarBlock hash={creator.address} />
                          {creators.length > 1 && idx < creators.length - 1 && (
                            <Divider color="bg-divider" className="my-2" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardWithLabel>
                </>
              )}

              <CardWithLabel label={<T id={'floorPrice'} />}>
                {isDefined(listing) ? (
                  <div className="flex items-center gap-x-1">
                    <Money shortened smallFractionFont={false} tooltip={true}>
                      {atomsToTokens(listing.floorPrice, listing.decimals)}
                    </Money>
                    <span> {listing.symbol}</span>
                  </div>
                ) : (
                  '-'
                )}
              </CardWithLabel>

              <Divider className="my-6" color="bg-divider" />
              <PropertiesItems assetSlug={assetSlug} accountPkh={account.publicKeyHash} details={details} />
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
});

export default CollectiblePage;
