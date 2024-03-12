import React, { FC, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import clsx from 'clsx';

import { HashChip, Identicon } from 'app/atoms';
import { CardContainer } from 'app/atoms/CardContainer';
import { ReactComponent as ArrowIcon } from 'app/icons/chevron-down.svg';
import { FiatBalance } from 'app/pages/Home/OtherComponents/Tokens/components/Balance';
import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { getAssetSymbol, useAssetMetadata } from 'lib/metadata';
import { mutezToTz } from 'lib/temple/helpers';
import { UserHistoryItem } from 'lib/temple/history';
import { HistoryItemOpTypeTexts } from 'lib/temple/history/consts';
import { buildHistoryMoneyDiffs } from 'lib/temple/history/helpers';

import { MoneyDiffView } from '../activity/MoneyDiffView';
import { OpenInExplorerChip } from '../OpenInExplorerChip';
import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { toHistoryTokenSlug } from './utils';

export type HistoryDetailsPopupProps = PopupModalWithTitlePropsProps & {
  historyItem: UserHistoryItem | null;
};

export const HistoryDetailsPopup: FC<HistoryDetailsPopupProps> = ({ historyItem, isOpen, ...props }) => {
  const { hash = '', addedAt = '', status = 'skipped' } = historyItem ?? {};

  const assetslug = toHistoryTokenSlug(historyItem);

  const assetMetadata = useAssetMetadata(assetslug);
  const assetSymbol = getAssetSymbol(assetMetadata);

  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem), [historyItem]);

  const [showFeeDetails, setShowFeedetails] = useState(true);

  const toggleFeesDropdown = useCallback(() => {
    setShowFeedetails(!showFeeDetails);
  }, [showFeeDetails]);

  const fees = useMemo(
    () =>
      historyItem?.operations.reduce<{
        gasFee: number;
        storageFee: number;
        networkFee: number;
        gasUsed: number;
        storageUsed: number;
      }>(
        (acc, item) => {
          acc.gasFee += item.bakerFee;
          acc.storageFee += item.storageFee;
          acc.gasUsed += item.gasUsed;
          acc.storageUsed += item.storageUsed;

          acc.networkFee = acc.gasFee + acc.storageFee;

          return acc;
        },
        { gasFee: 0, storageFee: 0, networkFee: 0, gasUsed: 0, storageUsed: 0 }
      ),
    [historyItem?.operations]
  );

  const burnedFee = useMemo(() => (fees ? (fees?.gasFee + fees?.gasUsed + fees?.storageUsed) * 0.5 : 0), [fees]);

  if (!historyItem) return null;

  return (
    <PopupModalWithTitle
      isOpen={isOpen}
      title={
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-secondary-white">{HistoryItemOpTypeTexts[historyItem.type]}</div>
          <div className="flex flex-col">
            {moneyDiffs.slice(0, 1).map(({ assetSlug, diff }, i) => (
              <MoneyDiffView
                key={i}
                assetId={assetSlug}
                diff={diff}
                pending={status === 'pending'}
                className="flex flex-col items-center"
                moneyClassname="text-xl leading-6 tracking-tight"
                isColored={false}
              />
            ))}
          </div>

          <HistoryTime addedAt={addedAt || historyItem.operations[0]?.addedAt} />
        </div>
      }
      portalClassName="token-details-popup"
      headerComponent={<HistoryTokenIcon historyItem={historyItem} size={44} />}
      {...props}
    >
      <div className="px-4">
        <CardContainer className="text-base-plus mb-6 text-white">
          <div className="flex items-center justify-between">
            <T id="status" />
            <span
              className={clsx('mb-2 capitalize', status === 'failed' ? 'text-primary-error' : 'text-primary-success')}
            >
              {status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>
              <T id="transactionId" />
            </span>
            <div className="flex items-center gap-1">
              <HashChip hash={hash} small showIcon={false} />
              <OpenInExplorerChip hash={hash} alternativeDesign />
            </div>
          </div>
        </CardContainer>

        <CardContainer className="mb-6 text-base-plus text-white">
          <span className="mb-2">
            <T id="receivedFrom" />
          </span>
          <div className="flex items-center gap-3">
            <Identicon
              type="bottts"
              size={24}
              hash={historyItem.operations[0]?.source.address ?? ''}
              className="flex-shrink-0 shadow-xs rounded-full"
            />
            <HashChip hash={historyItem.operations[0]?.source.address ?? ''} small className="text-sm" />
          </div>
        </CardContainer>

        <CardContainer className={clsx('text-sm text-white flex flex-col', showFeeDetails ? 'gap-2' : 'gap-0')}>
          <div className="flex justify-between items-start text-base-plus">
            <div className="flex items-center gap-1" onClick={toggleFeesDropdown}>
              *
              <T id="networkFees" />
              <ArrowIcon
                className={clsx(
                  'w-6 h-auto stroke-white stroke-1 transition ease-in-out duration-200 cursor-pointer',
                  showFeeDetails && 'transform rotate-180'
                )}
              />
            </div>

            <div className="flex flex-col items-end">
              <FiatBalance
                assetSlug={assetslug}
                value={`${mutezToTz(fees?.networkFee) ?? 0}`}
                showEqualSymbol={false}
                className="text-base-plus"
                roundingMode={BigNumber.ROUND_CEIL}
                customSymbol="-"
              />

              <div className="text-sm text-secondary-white">
                <span>-{mutezToTz(fees?.networkFee).toFixed()}</span>
                &nbsp;
                <span>{assetSymbol}</span>
              </div>
            </div>
          </div>
          <div
            className={clsx(
              'flex flex-col gap-2',
              'transition ease-in-out duration-200',
              showFeeDetails ? 'max-h-40' : 'max-h-0 overflow-hidden'
            )}
          >
            <div className="flex justify-between items-center">
              <span>
                <T id="gasFee" />
              </span>
              <span className="text-secondary-white flex items-center capitalize">
                <span>-{mutezToTz(fees?.gasFee).toFixed()}</span>
                &nbsp;
                <span>{assetSymbol}</span>
              </span>
            </div>
            <div className="flex justify-between items-center capitalize">
              <span>
                <T id="storageFee" />
              </span>
              <span className="text-secondary-white">
                <span className="text-secondary-white flex items-center">
                  <span>-{mutezToTz(fees?.storageFee).toFixed()}</span>
                  &nbsp;
                  <span>{assetSymbol}</span>
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>
                <T id="burnedFromFees" />
              </span>
              <span className="text-secondary-white">
                <span>-{mutezToTz(burnedFee).toFixed()}</span>
                &nbsp;
                <span>{assetSymbol}</span>
              </span>
            </div>
          </div>
        </CardContainer>
      </div>
    </PopupModalWithTitle>
  );
};
