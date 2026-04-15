import React, { FC, HTMLAttributes, memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { BakerLogo, Identicon, Name, Money, HashChip, ABContainer } from 'app/atoms';
import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { BakerTable, BakerTableData } from 'app/molecules/BakerTable/BakerTable';
import { BakingSectionSelectors } from 'app/pages/Home/OtherComponents/BakingSection.selectors';
import { T, toLocalFormat } from 'lib/i18n';
import { RECOMMENDED_BAKER_ADDRESS } from 'lib/known-bakers';
import { MAVEN_METADATA } from 'lib/metadata';
import { useRelevantAccounts, useAccount, useNetwork, useKnownBaker } from 'lib/temple/front';
import { calculateCapacities } from 'lib/temple/front/baking/utils';
import { atomsToTokens } from 'lib/temple/helpers';
import { TempleAccount } from 'lib/temple/types';

import { OpenInExplorerChip } from './OpenInExplorerChip';

// ---------------------------------------------------------------------------
// Internal hook — avoids duplicating the atomsToTokens call across sub-components
// ---------------------------------------------------------------------------
function useBakerSpace(freeSpace: number | undefined) {
  return useMemo(() => atomsToTokens(freeSpace ?? 0, MAVEN_METADATA.decimals), [freeSpace]);
}

type BakerBannerProps = HTMLAttributes<HTMLDivElement> & {
  bakerPkh: string;
  link?: boolean;
  displayAddress?: boolean;
  displayBg?: boolean;
  displayDivider?: boolean;
  alternativeTableData?: boolean;
  extraComponent?: React.ReactNode;
};

const BakerBanner = memo<BakerBannerProps>(
  ({
    bakerPkh,
    link = false,
    displayAddress = false,
    displayDivider = false,
    displayBg = false,
    alternativeTableData = false,
    extraComponent,
    className,
    style
  }) => {
    const allAccounts = useRelevantAccounts();
    const account = useAccount();
    const { data: baker } = useKnownBaker(bakerPkh);

    const { delegatedFreeSpace } = useMemo(() => {
      const { stakedBalance, delegatedBalance, externalStakedBalance } = baker ?? {
        stakedBalance: 0,
        delegatedBalance: 0,
        externalStakedBalance: 0
      };
      return calculateCapacities({ stakedBalance, delegatedBalance, externalStakedBalance });
    }, [baker]);

    const bakerAcc = useMemo(
      () => allAccounts.find(acc => acc.publicKeyHash === bakerPkh) ?? null,
      [allAccounts, bakerPkh]
    );

    const isRecommendedBaker = bakerPkh === RECOMMENDED_BAKER_ADDRESS;
    // const isHelpUkraineBaker = bakerPkh === HELP_UKRAINE_BAKER_ADDRESS;

    const bakerSpace = useBakerSpace(baker?.freeSpace);

    const feeTableItem: BakerTableData = useMemo(
      () => ({
        i18nKey: 'fee',
        child: (
          <>
            {baker?.fee ? (
              <>
                {toLocalFormat(new BigNumber(baker?.fee ?? 0).times(100), {
                  decimalPlaces: 2
                })}
                %
              </>
            ) : (
              <>NA</>
            )}
          </>
        )
      }),
      [baker?.fee]
    );

    const bakerTableData: BakerTableData[] = useMemo(
      () =>
        baker
          ? alternativeTableData
            ? [
                { ...feeTableItem },
                {
                  i18nKey: 'ETD',
                  child: (
                    <>
                      {/* TODO calculate ETD and add symbol */}
                      {/* <Money>{(baker.stakedBalance / 1000).toFixed(0)}</Money> */}
                      NA
                    </>
                  )
                },
                {
                  i18nKey: 'nextPayout',
                  child: (
                    <>
                      {/* TODO calculate baker payout time */}
                      {/* {formatDistanceToNow(new Date(new Date().getTime() + 90 * 60 * 60 * 1000), {
                        includeSeconds: true,
                        addSuffix: true,
                        locale: getDateFnsLocale()
                      })} */}
                      NA
                    </>
                  )
                }
              ]
            : [
                // {
                //   i18nKey: 'upTime',
                //   child: (
                //     <>
                //       {/* {toLocalFormat(new BigNumber(baker.estimatedRoi ?? 0).times(100), {
                //         decimalPlaces: 2
                //       })} */}
                //       NA
                //     </>
                //   )
                // },
                { ...feeTableItem },
                {
                  i18nKey: 'space',
                  child: (
                    <div className={classNames(delegatedFreeSpace < 0 && 'text-primary-error')}>
                      <Money smallFractionFont={false} shortened>
                        {bakerSpace}
                      </Money>
                    </div>
                  )
                }
              ]
          : [],
      [alternativeTableData, baker, feeTableItem, bakerSpace, delegatedFreeSpace]
    );

    return (
      <div
        className={classNames('w-full', 'py-14px px-4', displayBg && 'bg-gray-910 rounded-2xl-plus', className)}
        style={{
          maxWidth: undefined,
          ...style
        }}
      >
        {baker ? (
          <>
            <div className={classNames('flex items-center', 'text-white')}>
              <div>
                <BakerLogo
                  logo={baker.logo}
                  address={baker.address}
                  size={59}
                  imgBg="bg-transparent"
                  style={{ minHeight: '2rem' }}
                />
              </div>

              <div className="flex flex-col items-start flex-1 ml-4 relative">
                <div
                  className={classNames(
                    'w-full mb-2 text-base-plus text-white',
                    'flex flex-wrap items-center',
                    displayDivider && 'border-b boder-divider pb-2',
                    displayAddress && 'justify-between'
                  )}
                >
                  {baker.name ? (
                    <Name
                      style={{
                        maxWidth: '9rem'
                      }}
                      testID={BakingSectionSelectors.delegatedBakerName}
                    >
                      {baker.name}
                    </Name>
                  ) : (
                    <div
                      style={{
                        maxWidth: '8rem'
                      }}
                    >
                      <HashChip hash={baker.address} small />
                    </div>
                  )}

                  {isRecommendedBaker && (
                    <ABContainer
                      groupAComponent={<SponsoredBaker isRecommendedBaker={isRecommendedBaker} />}
                      groupBComponent={<PromotedBaker isRecommendedBaker={isRecommendedBaker} />}
                    />
                  )}

                  {displayAddress && (
                    <div className="ml-2 flex flex-wrap items-center">
                      <HashChip hash={baker.address} small />
                    </div>
                  )}
                </div>

                <BakerTable data={bakerTableData} />

                {link && (
                  <div className={classNames('absolute right-0 top-0 bottom-0', 'flex items-center', 'text-white')}>
                    <ChevronRightIcon className="h-6 w-auto" />
                  </div>
                )}
              </div>
            </div>
            {extraComponent}
          </>
        ) : (
          <div className={classNames('flex items-stretch', 'text-white')}>
            <div>
              <Identicon type="bottts" hash={bakerPkh} size={59} className="shadow-xs rounded-full" />
            </div>

            <div className="flex flex-col items-start flex-1 ml-2">
              <div className={classNames('mb-px w-full', 'flex flex-col gap-2 items-start ml-3', 'leading-none')}>
                <Name className="pb-1 mr-1 text-base-plus">
                  <BakerAccount account={account} bakerAcc={bakerAcc} bakerPkh={bakerPkh} />
                </Name>

                {displayAddress && (
                  <div className="flex flex-wrap items-center">
                    <HashChip hash={bakerPkh} small />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export const CoStakeBakerBanner: FC<{ bakerPkh: string }> = ({ bakerPkh }) => {
  const { data: baker } = useKnownBaker(bakerPkh);

  const { delegatedFreeSpace } = useMemo(() => {
    const { stakedBalance, delegatedBalance, externalStakedBalance } = baker ?? {
      stakedBalance: 0,
      delegatedBalance: 0,
      externalStakedBalance: 0
    };
    return calculateCapacities({ stakedBalance, delegatedBalance, externalStakedBalance });
  }, [baker]);

  const isRecommendedBaker = bakerPkh === RECOMMENDED_BAKER_ADDRESS;
  const bakerSpace = useBakerSpace(baker?.freeSpace);

  return baker ? (
    <div className={classNames('w-full', 'p-4', 'bg-gray-910 rounded-2xl-plus')}>
      <div className="flex items-center gap-2 mb-4">
        <Identicon type="bottts" hash={baker.address} size={32} className="shadow-xs rounded-full flex-shrink-0" />

        <div className="flex flex-col items-start flex-1 relative gap-1 min-w-0">
          <Name
            style={{ maxWidth: '100%' }}
            className="text-base-plus text-white truncate"
            title={baker.name || baker.address}
            testID={BakingSectionSelectors.delegatedBakerName}
          >
            {baker.name || baker.address}
          </Name>

          <div className="flex flex-wrap items-center">
            <HashChip hash={baker.address} small />
          </div>
        </div>

        {isRecommendedBaker && (
          <ABContainer
            groupAComponent={<SponsoredBaker isRecommendedBaker={isRecommendedBaker} />}
            groupBComponent={<PromotedBaker isRecommendedBaker={isRecommendedBaker} />}
          />
        )}
      </div>
      <div className="text-base-plus text-white flex items-center justify-between">
        <span>
          <T id="bakerFreeSpace" />
        </span>
        <div className={classNames('flex items-center gap-1', delegatedFreeSpace < 0 && 'text-primary-error')}>
          <Money smallFractionFont={false}>{bakerSpace}</Money>
          <span>{MAVEN_METADATA.symbol}</span>
        </div>
      </div>
    </div>
  ) : null;
};

export default BakerBanner;

const BakerAccount: React.FC<{
  bakerAcc: TempleAccount | null;
  account: TempleAccount;
  bakerPkh: string;
}> = ({ bakerAcc, account, bakerPkh }) => {
  const network = useNetwork();

  return bakerAcc ? (
    <>
      {bakerAcc.name}
      {bakerAcc.publicKeyHash === account.publicKeyHash && (
        <T id="selfComment">
          {message => (
            <>
              {' '}
              <span className="font-light opacity-75">{message}</span>
            </>
          )}
        </T>
      )}
    </>
  ) : network.type === 'dcp' ? (
    <div className="flex">
      <HashChip bgShade={200} rounded="base" className="mr-1" hash={bakerPkh} small textShade={700} />

      <OpenInExplorerChip hash={bakerPkh} type="account" small alternativeDesign />
    </div>
  ) : (
    <T id="unknownBakerTitle">
      {message => <span className="font-normal">{typeof message === 'string' ? message.toLowerCase() : message}</span>}
    </T>
  );
};

const SponsoredBaker: FC<{ isRecommendedBaker: boolean }> = ({ isRecommendedBaker }) => (
  <div className={classNames('font-normal text-xs px-2 py-1 bg-indigo-add text-white ml-2 rounded')}>
    <T id={isRecommendedBaker ? 'ad' : 'helpUkraine'} />
  </div>
);
const PromotedBaker: FC<{ isRecommendedBaker: boolean }> = ({ isRecommendedBaker }) => (
  <div className={classNames('font-normal text-xs px-2 py-1 bg-indigo-add text-white ml-2 rounded')}>
    <T id={isRecommendedBaker ? 'recommended' : 'helpUkraine'} />
  </div>
);
