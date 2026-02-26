import React, { useMemo, useState } from 'react';

import classNames from 'clsx';
import { UseFormTrigger } from 'react-hook-form';

import { Button } from 'app/atoms';
import { useAppEnv } from 'app/env';
import BakerBanner from 'app/templates/BakerBanner';
import { SortButton, SortListItemType, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
import { ABTestGroup } from 'lib/apis/temple';
import { T } from 'lib/i18n';
import { HELP_UKRAINE_BAKER_ADDRESS, RECOMMENDED_BAKER_ADDRESS } from 'lib/known-bakers';
import { useAccount, useDelegate, useKnownBakers } from 'lib/temple/front';
import { calculateCapacities } from 'lib/temple/front/baking/utils';
import { navigate } from 'lib/woozie';

import { useUserTestingGroupNameSelector } from '../../../store/ab-testing/selectors';
import { DelegateFormSelectors } from '../delegateForm.selectors';

export enum SortOptions {
  AVAILABLE_SPACE = 'availableSpace',
  FEE = 'fee',
  DEFAULT = 'default'
}

interface FormData {
  to: string;
  fee: number;
}

type KnownDelegatorsListProps = {
  setValue: any;
  trigger: UseFormTrigger<FormData>;
};

export const KnownDelegatorsList: React.FC<KnownDelegatorsListProps> = ({ setValue, trigger }) => {
  const knownBakers = useKnownBakers();
  const acc = useAccount();

  const accountPkh = acc.publicKeyHash;

  const { data: accStats } = useDelegate(accountPkh);
  const myBakerPkh = accStats?.delegate?.address ?? '';

  const testGroupName = useUserTestingGroupNameSelector();
  const { popup } = useAppEnv();

  const [sortOption, setSortOption] = useState<SortOptions>(SortOptions.DEFAULT);

  const memoizedSortAssetsOptions: SortListItemType[] = useMemo(
    () => [
      {
        id: SortOptions.DEFAULT,
        selected: sortOption === SortOptions.DEFAULT,
        onClick: () => setSortOption(SortOptions.DEFAULT),
        nameI18nKey: 'default'
      },
      {
        id: SortOptions.AVAILABLE_SPACE,
        selected: sortOption === SortOptions.AVAILABLE_SPACE,
        onClick: () => {
          setSortOption(SortOptions.AVAILABLE_SPACE);
        },
        nameI18nKey: 'availableSpace'
      },
      {
        id: SortOptions.FEE,
        selected: sortOption === SortOptions.FEE,
        onClick: () => setSortOption(SortOptions.FEE),
        nameI18nKey: 'fee'
      }
    ],
    [sortOption]
  );

  const baseSortedKnownBakers = useMemo(() => {
    if (!knownBakers) return null;

    const toSort = Array.from(knownBakers);

    switch (sortOption) {
      case SortOptions.AVAILABLE_SPACE:
        return toSort.sort((a, b) => (b.freeSpace ?? 0) - (a.freeSpace ?? 0));

      case SortOptions.FEE:
        return toSort.sort((a, b) => (b.fee ?? 0) - (a.fee ?? 0));

      case SortOptions.DEFAULT:
      default:
        // SORTED_PREDEFINED_SPONSORED_BAKERS
        return toSort.sort((a, b) => {
          const { totalFreSpace: aTotalFreeSpace, totalCapacity: aTotalCapacity } = calculateCapacities({
            stakedBalance: a.stakedBalance,
            delegatedBalance: a.delegatedBalance,
            externalStakedBalance: a.externalStakedBalance
          });

          const { totalFreSpace: bTotalFreeSpace, totalCapacity: bTotalCapacity } = calculateCapacities({
            stakedBalance: b.stakedBalance,
            delegatedBalance: b.delegatedBalance,
            externalStakedBalance: b.externalStakedBalance
          });

          const aTotalFreeSpacePercent = aTotalCapacity > 0 ? (aTotalFreeSpace / aTotalCapacity) * 100 : 0;

          const bTotalFreeSpacePercent = bTotalCapacity > 0 ? (bTotalFreeSpace / bTotalCapacity) * 100 : 0;

          return bTotalFreeSpacePercent - aTotalFreeSpacePercent;
        });
    }
  }, [knownBakers, sortOption]);

  if (!baseSortedKnownBakers) return null;

  const sponsoredBakers = baseSortedKnownBakers.filter(
    baker => baker.address === RECOMMENDED_BAKER_ADDRESS || baker.address === HELP_UKRAINE_BAKER_ADDRESS
  );

  const sortedKnownBakers = [
    ...sponsoredBakers,
    ...baseSortedKnownBakers.filter(
      baker =>
        baker.address !== RECOMMENDED_BAKER_ADDRESS &&
        baker.address !== HELP_UKRAINE_BAKER_ADDRESS &&
        baker.address !== myBakerPkh
    )
  ];

  return (
    <div className="flex flex-col">
      <h2 className=" w-full mb-4 -mt-2 leading-tight flex items-center justify-between">
        <span className="text-base-plus text-white">
          <T id="delegateToPromotedValidators" />
        </span>

        <SortPopup>
          <SortButton className="-mr-1" />
          <SortPopupContent items={memoizedSortAssetsOptions} alternativeLogic={!popup} />
        </SortPopup>
      </h2>

      <div className="flex flex-col overflow-hidden text-white text-sm mt-1">
        {sortedKnownBakers.map((baker, i, arr) => {
          const last = i === arr.length - 1;
          const handleBakerClick = () => {
            setValue('to', baker.address);
            trigger('to');
            window.scrollTo(0, 0);
            navigate(`/stake/${baker.address}`);
          };

          let testId = DelegateFormSelectors.knownBakerItemButton;
          let classnames = classNames(
            'hover:bg-primary-card',
            'transition ease-in-out duration-200',
            'focus:outline-none'
          );

          if (baker.address === RECOMMENDED_BAKER_ADDRESS) {
            testId = DelegateFormSelectors.knownBakerItemAButton;
            if (testGroupName === ABTestGroup.B) {
              testId = DelegateFormSelectors.knownBakerItemBButton;
              classnames = classNames(
                'hover:bg-primary-card',
                'transition ease-in-out duration-200',
                'focus:outline-none',
                'opacity-90 hover:opacity-100'
              );
            }
          }

          return (
            <Button
              key={baker.address}
              type="button"
              className={classnames}
              onClick={handleBakerClick}
              testID={testId}
              testIDProperties={{ bakerAddress: baker.address, abTestingCategory: testGroupName }}
            >
              <BakerBanner
                bakerPkh={baker.address}
                link
                style={{ width: undefined }}
                className={classNames(!last && 'border-b border-divider')}
              />
            </Button>
          );
        })}
      </div>
    </div>
  );
};
