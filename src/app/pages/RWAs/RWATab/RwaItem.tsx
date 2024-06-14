import React, { memo, useRef, FC } from 'react';

import clsx from 'clsx';

import { Divider, Money } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { useAllRwasDetailsLoadingSelector, useRwaDetailsSelector } from 'app/store/rwas/selectors';
// import { useRwaMetadataSelector } from 'app/store/rwas-metadata/selectors';
import { useRwaMetadataSelector } from 'app/store/rwas-metadata/selectors';
import InFiat from 'app/templates/InFiat';
import { isTzbtcAsset } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { getAssetName } from 'lib/metadata';
import { ZERO } from 'lib/utils/numbers';
import { Link } from 'lib/woozie';

import { RwaItemImage } from './RwaItemImage';

interface Props {
  assetSlug: string;
  accountPkh: string;
  areDetailsShown: boolean;
  chainId: string;
}

export const RwaItem = memo<Props>(({ assetSlug, accountPkh }) => {
  const { popup } = useAppEnv();
  const metadata = useRwaMetadataSelector(assetSlug);
  const { value: balance = ZERO } = useBalance(assetSlug, accountPkh);
  const toDisplayRef = useRef<HTMLDivElement>(null);

  const areDetailsLoading = useAllRwasDetailsLoadingSelector();
  const details = useRwaDetailsSelector(assetSlug);

  const assetName = getAssetName(metadata);
  const isTzBTC = isTzbtcAsset(assetSlug);

  return (
    <div className="relative overflow-x-hidden">
      <Link
        to={`/rwa/${assetSlug}`}
        className={clsx('relative flex gap-x-4 items-center rounded-2xl max-w-full', !popup && 'px-4')}
      >
        <div
          ref={toDisplayRef}
          className={clsx(
            'relative flex items-center justify-center bg-gray-405 rounded-lg overflow-hidden hover:opacity-70'
          )}
          style={{ width: 59, height: 59 }}
          title={assetName}
        >
          <RwaItemImage
            assetSlug={assetSlug}
            metadata={metadata}
            areDetailsLoading={areDetailsLoading && details === undefined}
            mime={details?.mime}
            // TODO add adult blur logic
            adultBlur={false}
            containerElemRef={toDisplayRef}
          />
        </div>

        <div className={clsx('mt-2 mb-2 flex flex-col items-start')}>
          <div
            className={clsx(
              'text-base-plus text-white overflow-x-auto truncate w-full mb-2',
              popup ? 'max-w-64' : 'max-w-96'
            )}
          >
            {assetName}
          </div>
          <div className="flex gap-x-6 items-start">
            <RWATableItem
              label="tokens"
              value={
                <div className="flex items-center">
                  <Money smallFractionFont={false} cryptoDecimals={isTzBTC ? metadata?.decimals : undefined}>
                    {balance ?? 0}
                  </Money>
                  <span>&nbsp;</span>
                  <span>{metadata?.symbol}</span>
                </div>
              }
            />
            <RWATableItem label="last sale" value="$50.00" />
            <RWATableItem
              label="total value"
              value={
                <InFiat assetSlug={assetSlug} volume={balance ?? 0} smallFractionFont={false}>
                  {({ balance, symbol }) => (
                    <div className="ml-1 font-normal text-white flex items-center truncate text-right">
                      <span>{symbol}</span>
                      {balance}
                    </div>
                  )}
                </InFiat>
              }
            />
          </div>
        </div>
      </Link>
      <Divider color="bg-divider" ignoreParent={!popup} />
    </div>
  );
});

type RWATableItemProps = {
  label: string;
  value: string | React.ReactElement;
};

const RWATableItem: FC<RWATableItemProps> = ({ label, value }) => {
  return (
    <section className="flex flex-col gap-y-1 justify-start text-xs">
      <div className="text-secondary-white capitalize">{label}</div>
      <div className="text-white">{value}</div>
    </section>
  );
};
