import React, { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { HashChip, ExternalLinkChip } from 'app/atoms';
import { fromFa2TokenSlug } from 'lib/assets/utils';
import { useBalance } from 'lib/balances';
import { formatDate, T } from 'lib/i18n';
import { useExplorerBaseUrls } from 'lib/temple/front';

import { CardWithLabel } from './CardWithLabel';

import { TemporaryRwaType } from '.';

interface PropertiesItemsProps {
  assetSlug: string;
  accountPkh: string;
  details?: TemporaryRwaType | null;
}

export const PropertiesItems = memo<PropertiesItemsProps>(({ assetSlug, accountPkh, details }) => {
  const { contract } = fromFa2TokenSlug(assetSlug);

  const { transaction: explorerBaseUrl } = useExplorerBaseUrls();
  const exploreContractUrl = useMemo(
    () => (explorerBaseUrl ? new URL(contract, explorerBaseUrl).href : null),
    [explorerBaseUrl, contract]
  );

  const itemValueClassName = 'text-base-plus text-white break-words';

  return (
    <>
      <section className="w-full grid grid-cols-2 gap-x-4 gap-y-6 mb-6">
        <CardWithLabel label={<T id={'yourTokens'} />}>
          <span className={itemValueClassName}>{details?.tokens}</span>
        </CardWithLabel>

        <CardWithLabel label={<T id={'totalValue'} />}>
          <span className={itemValueClassName}>${details?.totalValue ?? '-'}</span>
        </CardWithLabel>

        <CardWithLabel label={<T id={'estMarketPrice'} />}>
          <span className={itemValueClassName}>${details?.estMarketPrice}</span>
        </CardWithLabel>

        <CardWithLabel label={<T id={'lastSale'} />}>
          <span className={itemValueClassName}>${details?.lastSale}</span>
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
