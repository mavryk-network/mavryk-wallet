import React, { FC, HTMLAttributes, memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { formatDistanceToNow } from 'date-fns';

import { Identicon, Name, Money, HashChip, ABContainer } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { BakerTable, BakerTableData } from 'app/molecules/BakerTable/BakerTable';
import { BakingSectionSelectors } from 'app/pages/Home/OtherComponents/BakingSection.selectors';
import { toLocalFormat, T, getDateFnsLocale } from 'lib/i18n';
import { useRelevantAccounts, useAccount, useNetwork, useKnownBaker } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

import { OpenInExplorerChip } from './OpenInExplorerChip';

// const mockedBaker: any = {
//   address: 'tz1fXRwGcgoz81Fsksx9L2rVD5wE6CpTMkLz',
//   name: 'Everstake',
//   logo: 'https://services.tzkt.io/v1/avatars/tz1fXRwGcgoz81Fsksx9L2rVD5wE6CpTMkLz',
//   balance: 12923.010257,
//   stakingBalance: 113315.976957,
//   stakingCapacity: 114000,
//   maxStakingBalance: 114000,
//   freeSpace: 684.0230429999938,
//   fee: 0.04,
//   minDelegation: 5,
//   payoutDelay: 6,
//   payoutPeriod: 1,
//   openForDelegation: true,
//   estimatedRoi: 0.06024,
//   serviceType: 'tezos_only',
//   serviceHealth: 'active',
//   payoutTiming: 'suspicious',
//   payoutAccuracy: 'inaccurate',
//   audit: '64e7621dd0970a602a90d4b1',
//   insuranceCoverage: 0,
//   config: {
//     address: 'tz1fXRwGcgoz81Fsksx9L2rVD5wE6CpTMkLz',
//     fee: [
//       {
//         cycle: 586,
//         value: 0.04
//       },
//       {
//         cycle: 0,
//         value: 0.15
//       }
//     ],
//     minDelegation: [
//       {
//         cycle: 586,
//         value: 5
//       },
//       {
//         cycle: 0,
//         value: 50
//       }
//     ],
//     payoutFee: [
//       {
//         cycle: 0,
//         value: true
//       }
//     ],
//     payoutDelay: [
//       {
//         cycle: 0,
//         value: 6
//       }
//     ],
//     payoutPeriod: [
//       {
//         cycle: 0,
//         value: 1
//       }
//     ],
//     minPayout: [
//       {
//         cycle: 0,
//         value: 0
//       }
//     ],
//     rewardStruct: [
//       {
//         cycle: 0,
//         value: 21
//       }
//     ],
//     payoutRatio: [
//       {
//         cycle: 0,
//         value: 666
//       }
//     ],
//     maxStakingThreshold: [
//       {
//         cycle: 0,
//         value: 1
//       }
//     ],
//     openForDelegation: [
//       {
//         cycle: 0,
//         value: true
//       }
//     ],
//     allocationFee: [
//       {
//         cycle: 0,
//         value: true
//       }
//     ]
//   }
// };

type BakerBannerProps = HTMLAttributes<HTMLDivElement> & {
  bakerPkh: string;
  link?: boolean;
  displayAddress?: boolean;
  displayBg?: boolean;
  displayDivider?: boolean;
  alternativeTableData?: boolean;
};

const BakerBanner = memo<BakerBannerProps>(
  ({
    bakerPkh,
    link = false,
    displayAddress = false,
    displayDivider = false,
    displayBg = false,
    alternativeTableData = false,
    className,
    style
  }) => {
    const allAccounts = useRelevantAccounts();
    const account = useAccount();
    const { popup } = useAppEnv();
    const { data: baker } = useKnownBaker(bakerPkh);

    const bakerAcc = useMemo(
      () => allAccounts.find(acc => acc.publicKeyHash === bakerPkh) ?? null,
      [allAccounts, bakerPkh]
    );

    // const isRecommendedBaker = bakerPkh === RECOMMENDED_BAKER_ADDRESS;
    // const isHelpUkraineBaker = bakerPkh === HELP_UKRAINE_BAKER_ADDRESS;

    const feeTableItem: BakerTableData = useMemo(
      () => ({
        i18nKey: 'fee',
        child: (
          <>
            {toLocalFormat(new BigNumber(baker?.fee ?? 0).times(100), {
              decimalPlaces: 2
            })}
            %
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
                      <Money>{(baker.stakingBalance / 1000).toFixed(0)}</Money>
                    </>
                  )
                },
                {
                  i18nKey: 'nextPayout',
                  child: (
                    <>
                      {/* TODO calculate baker payout time */}
                      {formatDistanceToNow(new Date(new Date().getTime() + 90 * 60 * 60 * 1000), {
                        includeSeconds: true,
                        addSuffix: true,
                        locale: getDateFnsLocale()
                      })}
                    </>
                  )
                }
              ]
            : [
                {
                  i18nKey: 'space',
                  child: (
                    <>
                      <Money>{(baker.freeSpace / 1000).toFixed(0)}</Money>K
                    </>
                  )
                },
                { ...feeTableItem },
                {
                  i18nKey: 'upTime',
                  child: (
                    <>
                      {toLocalFormat(new BigNumber(baker.estimatedRoi).times(100), {
                        decimalPlaces: 2
                      })}
                      %
                    </>
                  )
                }
              ]
          : [],
      [alternativeTableData, baker, feeTableItem]
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
                <img
                  src={baker.logo}
                  alt={baker.name}
                  className={classNames('flex-shrink-0', 'bg-white rounded-full')}
                  style={{
                    minHeight: '2rem',
                    width: 59,
                    height: 59
                  }}
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
                  <Name
                    style={{
                      maxWidth: '12rem'
                    }}
                    testID={BakingSectionSelectors.delegatedBakerName}
                  >
                    {baker.name}
                  </Name>

                  {/* {(isRecommendedBaker || isHelpUkraineBaker) && (
                    <ABContainer
                      groupAComponent={<SponsoredBaker isRecommendedBaker={isRecommendedBaker} />}
                      groupBComponent={<PromotedBaker isRecommendedBaker={isRecommendedBaker} />}
                    />
                  )} */}

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
  <div
    className={classNames('font-normal text-xs px-2 py-1 bg-accent-blue text-white ml-2')}
    style={{ borderRadius: '10px' }}
  >
    <T id={isRecommendedBaker ? 'recommended' : 'helpUkraine'} />
  </div>
);
const PromotedBaker: FC<{ isRecommendedBaker: boolean }> = ({ isRecommendedBaker }) => (
  <div
    className={classNames('font-normal text-xs px-2 py-1 bg-accent-blue text-white ml-2')}
    style={{ borderRadius: '10px' }}
  >
    <T id={isRecommendedBaker ? 'recommended' : 'helpUkraine'} />
  </div>
);
