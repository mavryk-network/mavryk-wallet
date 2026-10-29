import React, { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { HashChip, ExternalLinkChip, Money } from 'app/atoms';
import { isTzbtcAsset } from 'lib/assets';
import { fromFa2TokenSlug } from 'lib/assets/utils';
import { T } from 'lib/i18n';
import type { RwaDetails } from 'lib/rwas/details.types';
import { isValidRwaDecimals } from 'lib/rwas/rwa-pricing.helpers';
import { useRwaPricing } from 'lib/rwas/use-rwa-pricing';
import { useExplorerBaseUrls } from 'lib/temple/front';

import { CardWithLabel } from './CardWithLabel';

const UNAVAILABLE_VALUE = '—';

interface PropertiesItemsProps {
  assetSlug: string;
  accountPkh: string;
  balance: BigNumber;
  symbol?: string;
  details?: RwaDetails | null;
}

interface UsdValueProps {
  value: BigNumber | null;
}

/** Wallet API pricing is USD-only, so it renders with `$` regardless of the selected fiat currency. */
const UsdValue = memo<UsdValueProps>(({ value }) =>
  value ? (
    <div className="flex items-center">
      <span>$</span>
      <Money smallFractionFont={false} fiat>
        {value}
      </Money>
    </div>
  ) : (
    <span>{UNAVAILABLE_VALUE}</span>
  )
);

export const PropertiesItems = memo<PropertiesItemsProps>(({ assetSlug, balance, symbol, details }) => {
  const { contract } = fromFa2TokenSlug(assetSlug);
  const { marketPriceUsd, lastSaleUsd, marketValueUsd } = useRwaPricing(details?.pricing);
  const isTzBTC = isTzbtcAsset(assetSlug);
  const decimals = details?.decimals;
  const hasValidDecimals = isValidRwaDecimals(decimals);

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
            {hasValidDecimals ? (
              <div className="text-white  flex items-center">
                <Money smallFractionFont={false} cryptoDecimals={isTzBTC ? Number(decimals) : undefined}>
                  {balance}
                </Money>
                <span>&nbsp;</span>
                <span>{symbol}</span>
              </div>
            ) : (
              <span>{UNAVAILABLE_VALUE}</span>
            )}
          </div>
        </CardWithLabel>

        <CardWithLabel label={<T id={'totalValue'} />}>
          <div className={itemValueClassName}>
            <UsdValue value={marketValueUsd} />
          </div>
        </CardWithLabel>

        <CardWithLabel label={<T id={'estMarketPrice'} />}>
          <div className={itemValueClassName}>
            <UsdValue value={marketPriceUsd} />
          </div>
        </CardWithLabel>

        <CardWithLabel label={<T id={'lastSale'} />}>
          <div className={itemValueClassName}>
            <UsdValue value={lastSaleUsd} />
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
