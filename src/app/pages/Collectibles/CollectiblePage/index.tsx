import React, { memo, useCallback, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import { useDispatch } from 'react-redux';

import { FormSubmitButton, FormSecondaryButton, Spinner, Money, Alert, Divider } from 'app/atoms';
import { CardContainer } from 'app/atoms/CardContainer';
import CopyButton from 'app/atoms/CopyButton';
import { useTabSlug } from 'app/atoms/useTabSlug';
import PageLayout from 'app/layouts/PageLayout';
import { AvatarBlock } from 'app/molecules/AvatarBlock/AvatarBlock';
import { loadCollectiblesDetailsActions } from 'app/store/collectibles/actions';
import {
  useAllCollectiblesDetailsLoadingSelector,
  useCollectibleDetailsSelector
} from 'app/store/collectibles/selectors';
import { useTokenMetadataSelector } from 'app/store/tokens-metadata/selectors';
import AddressChip from 'app/templates/AddressChip';
import OperationStatus from 'app/templates/OperationStatus';
import { TabsBar } from 'app/templates/TabBar/TabBar';
import { objktCurrencies } from 'lib/apis/objkt';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { t, T } from 'lib/i18n';
import { getAssetName } from 'lib/metadata';
import { useAccount } from 'lib/temple/front';
import { formatTcInfraImgUri } from 'lib/temple/front/image-uri';
import { atomsToTokens } from 'lib/temple/helpers';
import { TempleAccountType } from 'lib/temple/types';
import { useInterval } from 'lib/ui/hooks';
import { Image } from 'lib/ui/Image';
import { navigate } from 'lib/woozie';

import { useCollectibleSelling } from '../hooks/use-collectible-selling.hook';
import { CollectiblesSelectors } from '../selectors';
import { AttributesItems } from './AttributesItems';
import { CollectiblePageImage } from './CollectiblePageImage';
import { PropertiesItems } from './PropertiesItems';

const DETAILS_SYNC_INTERVAL = 4 * BLOCK_DURATION;

interface Props {
  assetSlug: string;
}

const CollectiblePage = memo<Props>(({ assetSlug }) => {
  const metadata = useTokenMetadataSelector(assetSlug);
  const details = useCollectibleDetailsSelector(assetSlug);
  const areAnyCollectiblesDetailsLoading = useAllCollectiblesDetailsLoadingSelector();

  const account = useAccount();

  const { publicKeyHash } = account;
  const accountCanSign = account.type !== TempleAccountType.WatchOnly;

  const areDetailsLoading = areAnyCollectiblesDetailsLoading && details === undefined;

  const collectibleName = getAssetName(metadata);

  const collection = useMemo(
    () =>
      details && {
        title: details.galleries[0]?.title ?? details.fa.name,
        logo: [formatTcInfraImgUri(details.fa.logo, 'small'), formatTcInfraImgUri(details.fa.logo, 'medium')]
      },
    [details]
  );

  const creators = details?.creators ?? [];

  const takableOffer = useMemo(
    () => details?.offers.find(({ buyer_address }) => buyer_address !== publicKeyHash),
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
  useInterval(() => void dispatch(loadCollectiblesDetailsActions.submit([assetSlug])), DETAILS_SYNC_INTERVAL, [
    dispatch,
    assetSlug
  ]);

  const displayedOffer = useMemo(() => {
    const highestOffer = details?.offers[0];
    if (!isDefined(highestOffer)) return null;

    const offer = takableOffer ?? highestOffer;

    const buyerIsMe = offer.buyer_address === publicKeyHash;

    const currency = objktCurrencies[offer.currency_id];
    if (!isDefined(currency)) return null;

    const price = atomsToTokens(offer.price, currency.decimals);

    return { price, symbol: currency.symbol, buyerIsMe };
  }, [details?.offers, takableOffer, publicKeyHash]);

  const sellButtonTooltipStr = useMemo(() => {
    if (!displayedOffer) return;
    if (displayedOffer.buyerIsMe) return t('cannotSellToYourself');

    let value = displayedOffer.price.toString();
    if (!accountCanSign) value += ` [${t('selectedAccountCannotSignTx')}]`;

    return value;
  }, [displayedOffer, accountCanSign]);

  const tabNameInUrl = useTabSlug();

  const tabs = useMemo(() => {
    const propertiesTab = { name: 'properties', titleI18nKey: 'properties' } as const;

    if (!details?.attributes.length) return [propertiesTab];

    return [{ name: 'attributes', titleI18nKey: 'attributes' } as const, propertiesTab];
  }, [details]);

  const { name: activeTabName } = useMemo(() => {
    const tab = tabNameInUrl ? tabs.find(({ name }) => name === tabNameInUrl) : null;

    return tab ?? tabs[0]!;
  }, [tabs, tabNameInUrl]);

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<span className="truncate">{collectibleName}</span>}>
      <div className="flex flex-col max-w-sm w-full mx-auto">
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

        <div className="rounded-2xl mb-6 bg-primary-card overflow-hidden" style={{ aspectRatio: '1/1' }}>
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
            {/* {collection && (
              <div className="flex justify-between items-center">
                <div className="flex items-center justify-center rounded">
                  <Image src={collection?.logo} className="w-6 h-6 rounded border border-gray-300" />
                  <div className="content-center ml-2 text-white text-sm">{collection?.title ?? ''}</div>
                </div>
              </div>
            )} */}

            <div className="flex gap-x-4 items-center w-full mb-4">
              <FormSubmitButton
                disabled={!displayedOffer || displayedOffer.buyerIsMe || isSelling || !accountCanSign}
                title={sellButtonTooltipStr}
                onClick={onSellButtonClick}
                testID={CollectiblesSelectors.sellButton}
              >
                {displayedOffer ? <T id="sell" /> : <T id="noOffersYet" />}
              </FormSubmitButton>

              <FormSubmitButton
                disabled={isSelling}
                onClick={onSendButtonClick}
                testID={CollectiblesSelectors.sendButton}
              >
                <T id="send" />
              </FormSubmitButton>
            </div>

            <CopyButton
              text={collectibleName}
              type={'block'}
              className={'text-white text-xl leading-6 tracking-tight truncate mb-2'}
            >
              {collectibleName}
            </CopyButton>

            <div className="text-base-plus text-white break-words">{details?.description ?? ''}</div>

            {creators.length > 0 && (
              <>
                <div className="self-start text-white text-base-plus mt-4 mb-3">
                  <T id={creators.length > 1 ? 'creators' : 'creator'} />
                </div>
                <CardContainer className="flex flex-col items-start">
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
                </CardContainer>
              </>
            )}

            <TabsBar tabs={tabs} activeTabName={activeTabName} withOutline />

            <div className="grid grid-cols-2 gap-2 text-gray-910">
              {activeTabName === 'attributes' ? (
                <AttributesItems details={details} />
              ) : (
                <PropertiesItems assetSlug={assetSlug} accountPkh={account.publicKeyHash} details={details} />
              )}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
});

export default CollectiblePage;
