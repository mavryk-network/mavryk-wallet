import React, { FC, HTMLAttributes, memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { Identicon, Name, Money, HashChip, ABContainer } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { BakingSectionSelectors } from 'app/pages/Home/OtherComponents/BakingSection.selectors';
import { toLocalFormat, T } from 'lib/i18n';
import { useRelevantAccounts, useAccount, useNetwork, useKnownBaker } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

import { HELP_UKRAINE_BAKER_ADDRESS, RECOMMENDED_BAKER_ADDRESS } from './DelegateForm';
import { OpenInExplorerChip } from './OpenInExplorerChip';

type BakerBannerProps = HTMLAttributes<HTMLDivElement> & {
  bakerPkh: string;
  link?: boolean;
  displayAddress?: boolean;
};

const BakerBanner = memo<BakerBannerProps>(({ bakerPkh, link = false, displayAddress = false, className, style }) => {
  const allAccounts = useRelevantAccounts();
  const account = useAccount();
  const { popup } = useAppEnv();
  const { data: baker } = useKnownBaker(bakerPkh);

  const bakerAcc = useMemo(
    () => allAccounts.find(acc => acc.publicKeyHash === bakerPkh) ?? null,
    [allAccounts, bakerPkh]
  );

  const isRecommendedBaker = bakerPkh === RECOMMENDED_BAKER_ADDRESS;
  const isHelpUkraineBaker = bakerPkh === HELP_UKRAINE_BAKER_ADDRESS;

  return (
    <div
      className={classNames('w-full', 'py-14px px-4', className)}
      style={{
        maxWidth: undefined,
        ...style
      }}
    >
      {baker ? (
        <>
          <div className={classNames('flex items-stretch', 'text-white')}>
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
              <div className={classNames('w-full mb-2 text-base-plus text-white', 'flex flex-wrap items-center')}>
                <Name
                  style={{
                    fontSize: '16px',
                    lineHeight: '16px',
                    maxWidth: isHelpUkraineBaker ? (popup ? '5rem' : '8rem') : '12rem'
                  }}
                  testID={BakingSectionSelectors.delegatedBakerName}
                >
                  {baker.name}
                </Name>

                {(isRecommendedBaker || isHelpUkraineBaker) && (
                  <ABContainer
                    groupAComponent={<SponsoredBaker isRecommendedBaker={isRecommendedBaker} />}
                    groupBComponent={<PromotedBaker isRecommendedBaker={isRecommendedBaker} />}
                  />
                )}

                {displayAddress && (
                  <div className="ml-2 flex flex-wrap items-center">
                    <OpenInExplorerChip hash={baker.address} type="account" small alternativeDesign />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center w-full">
                <div className={classNames('flex items-start', popup ? (link ? 'mr-6' : 'mr-7') : 'mr-8')}>
                  <div
                    className={classNames(
                      'text-xs leading-tight flex',
                      'text-secondary-white flex-col',
                      'items-start flex-1'
                    )}
                  >
                    <T id="space" />
                    <span className="mt-1 text-white flex">
                      <Money>{(baker.freeSpace / 1000).toFixed(0)}</Money>K
                    </span>
                  </div>
                </div>

                <div className={classNames('flex items-start', popup ? 'mr-6' : 'mr-16')}>
                  <div
                    className={classNames(
                      'text-xs leading-tight',
                      'text-secondary-white flex flex-col',
                      'items-start flex-1'
                    )}
                  >
                    <T id="fee" />
                    <span className="mt-1 text-white">
                      {toLocalFormat(new BigNumber(baker.fee).times(100), {
                        decimalPlaces: 2
                      })}
                      %
                    </span>
                  </div>
                </div>

                <div className={classNames('flex items-start', popup ? (link ? 'mr-6' : 'mr-7') : 'mr-8')}>
                  <div
                    className={classNames(
                      'text-xs leading-tight flex',
                      'text-secondary-white flex-col',
                      'items-start flex-1'
                    )}
                  >
                    <T id="upTime" />
                    <span className="mt-1 text-white flex">
                      {toLocalFormat(new BigNumber(baker.estimatedRoi).times(100), {
                        decimalPlaces: 2
                      })}
                      %{/* <Money>{(baker.estimatedRoi / 1000).toFixed(0)}</Money> */}
                    </span>
                  </div>
                </div>
              </div>
              {link && (
                <div className={classNames('absolute right-0 top-0 bottom-0', 'flex items-center', 'text-white')}>
                  <ChevronRightIcon className="h-6 w-auto" />
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className={classNames('flex items-stretch', 'text-gray-700')}>
          <div>
            <Identicon type="bottts" hash={bakerPkh} size={40} className="shadow-xs" />
          </div>

          <div className="flex flex-col items-start flex-1 ml-2">
            <div className={classNames('mb-px w-full', 'flex flex-wrap items-center', 'leading-none')}>
              <Name className="pb-1 mr-1 text-lg font-medium">
                <BakerAccount account={account} bakerAcc={bakerAcc} bakerPkh={bakerPkh} />
              </Name>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

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
