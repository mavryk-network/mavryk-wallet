import React, { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { HashChip, ExternalLinkChip } from 'app/atoms';
import type { CollectibleDetails } from 'app/store/collectibles/state';
import { fromFa2TokenSlug } from 'lib/assets/utils';
import { useBalance } from 'lib/balances';
import { formatDate, T } from 'lib/i18n';
import { useExplorerBaseUrls } from 'lib/temple/front';

import { CardWithLabel } from './CardWithLabel';

interface PropertiesItemsProps {
  assetSlug: string;
  accountPkh: string;
  details?: CollectibleDetails | null;
}

export const PropertiesItems = memo<PropertiesItemsProps>(({ assetSlug, accountPkh, details }) => {
  const { contract } = fromFa2TokenSlug(assetSlug);

  const { value: balance } = useBalance(assetSlug, accountPkh);

  const { transaction: explorerBaseUrl } = useExplorerBaseUrls();
  const exploreContractUrl = useMemo(
    () => (explorerBaseUrl ? new URL(contract, explorerBaseUrl).href : null),
    [explorerBaseUrl, contract]
  );

  const mintedTimestamp = useMemo(() => {
    const value = details?.mintedTimestamp;

    return value ? formatDate(value, 'd MMMM, yyyy') : '-';
  }, [details?.mintedTimestamp]);

  const royaltiesStr = useMemo(() => {
    if (!details?.royalties) return '-';

    const royalties = new BigNumber(details.royalties).decimalPlaces(2);

    return `${royalties.toString()}%`;
  }, [details]);

  const itemValueClassName = 'text-base-plus text-white break-words';

  return (
    <>
      <section className="w-full grid grid-cols-2 gap-x-4 gap-y-6 mb-6">
        <CardWithLabel label={<T id={'yourTokens'} />}>
          <span className={itemValueClassName}>{details?.supply ?? '-'}</span>
        </CardWithLabel>

        <CardWithLabel label={<T id={'totalValue'} />}>
          <span className={itemValueClassName}>{balance?.toString() ?? '-'}</span>
        </CardWithLabel>

        <CardWithLabel label={<T id={'estMarketPrice'} />}>
          <span className={itemValueClassName}>{mintedTimestamp}</span>
        </CardWithLabel>

        <CardWithLabel label={<T id={'lastSale'} />}>
          <span className={itemValueClassName}>{royaltiesStr}</span>
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
