import React, { memo, useMemo } from 'react';

import { HashChip, ExternalLinkChip, Money } from 'app/atoms';
import { CardWithLabel } from 'app/templates/CardWithLabel';
import InFiat from 'app/templates/InFiat';
import { isTzbtcAsset } from 'lib/assets';
import { fromFa2TokenSlug } from 'lib/assets/utils';
import { useAssetFiatCurrencyPrice, useFiatCurrency } from 'lib/fiat-currency';
import { T } from 'lib/i18n';
import { useExplorerBaseUrls } from 'lib/temple/front';

import { renderFiatBalance } from '../components/FiatBalanceDisplay';

import { RwaDetailsDisplay } from '.';

interface PropertiesItemsProps {
  assetSlug: string;
  accountPkh: string;
  details?: RwaDetailsDisplay | null;
}

export const PropertiesItems = memo<PropertiesItemsProps>(({ assetSlug, details }) => {
  const { contract } = fromFa2TokenSlug(assetSlug);
  const isTzBTC = isTzbtcAsset(assetSlug);
  const price = useAssetFiatCurrencyPrice(assetSlug);
  const { selectedFiatCurrency } = useFiatCurrency();

  const { contract: explorerBaseUrl } = useExplorerBaseUrls();

  const exploreContractUrl = useMemo(
    () => (explorerBaseUrl ? new URL(contract, explorerBaseUrl).href : null),
    [explorerBaseUrl, contract]
  );

  const itemValueClassName = 'text-base-plus text-white break-words';

  return (
    <>
      <section className="w-full grid grid-cols-2 gap-x-4 gap-y-6 mb-6">
        <CardWithLabel label={<T id={'yourTokens'} />}>
          <div className={itemValueClassName}>
            <div className="text-white  flex items-center">
              <Money smallFractionFont={false} cryptoDecimals={isTzBTC ? details?.metadata?.decimals : undefined}>
                {details?.tokens ?? 0}
              </Money>
              <span>&nbsp;</span>
              <span>{details?.metadata?.symbol}</span>
            </div>
          </div>
        </CardWithLabel>

        <CardWithLabel label={<T id={'totalValue'} />}>
          <span className={itemValueClassName}>
            <InFiat assetSlug={assetSlug} volume={details?.tokens ?? 0} smallFractionFont={false}>
              {renderFiatBalance}
            </InFiat>
          </span>
        </CardWithLabel>

        <CardWithLabel label={<T id={'estMarketPrice'} />}>
          <div className={itemValueClassName}>
            {selectedFiatCurrency.symbol}
            <Money smallFractionFont={false}>{price}</Money>
          </div>
        </CardWithLabel>

        <CardWithLabel label={<T id={'lastSale'} />}>
          <div className={itemValueClassName}>
            <Money smallFractionFont={false}>{price}</Money>
          </div>
        </CardWithLabel>
      </section>

      <div style={{ maxWidth: 343 }}>
        <CardWithLabel label={<T id={'assetId'} />}>
          <div className="flex items-center">
            <HashChip
              hash={contract}
              firstCharsCount={5}
              lastCharsCount={5}
              className="tracking-tighter"
              rounded="base"
              showIcon={false}
            />
            {exploreContractUrl && (
              <ExternalLinkChip href={exploreContractUrl} alternativeDesign tooltip="Explore contract" />
            )}
          </div>
        </CardWithLabel>
      </div>
    </>
  );
});
