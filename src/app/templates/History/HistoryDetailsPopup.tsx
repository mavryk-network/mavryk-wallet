import React, { FC, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import clsx from 'clsx';

import { Divider, HashChip, Identicon } from 'app/atoms';
import { CardContainer } from 'app/atoms/CardContainer';
import { ListItemDivider } from 'app/atoms/Divider';
import { ReactComponent as ArrowIcon } from 'app/icons/chevron-down.svg';
import { ReactComponent as ParallelArrowsIcon } from 'app/icons/parallel-opposing-arrows.svg';
import { FiatBalance } from 'app/pages/Home/OtherComponents/Tokens/components/Balance';
import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { T } from 'lib/i18n';
import { AssetMetadataBase, getAssetSymbol, useAssetMetadata, useMultipleAssetsMetadata } from 'lib/metadata';
import { mumavToTz } from 'lib/temple/helpers';
import { UserHistoryItem } from 'lib/temple/history';
import { HistoryItemOpTypeTexts, HistoryItemTypeLabels } from 'lib/temple/history/consts';
import { buildHistoryMoneyDiffs, buildHistoryOperStack, MoneyDiff } from 'lib/temple/history/helpers';
import {
  HistoryItemDelegationOp,
  HistoryItemOpTypeEnum,
  HistoryItemOriginationOp,
  HistoryItemOtherOp,
  HistoryItemStatus,
  HistoryItemTransactionOp,
  IndividualHistoryItem
} from 'lib/temple/history/types';

import { MoneyDiffView } from '../activity/MoneyDiffView';
import { OpenInExplorerChip } from '../OpenInExplorerChip';

import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { OpertionStackItem } from './OperStackItem';
import { alterIpfsUrl, getAssetsFromOperations, getMoneyDiffsForSwap } from './utils';

// import { toHistoryTokenSlug } from './utils';

const TX_HISTORY_PREVIEW_IDX = 2;

export type HistoryDetailsPopupProps = PopupModalWithTitlePropsProps & {
  historyItem: UserHistoryItem | null;
};

export const HistoryDetailsPopup: FC<HistoryDetailsPopupProps> = ({ historyItem, isOpen, ...props }) => {
  const { hash = '', addedAt = '', status = 'skipped' } = historyItem ?? {};

  const mainAssetMetadata = useAssetMetadata(MAV_TOKEN_SLUG);
  const mainAssetSymbol = getAssetSymbol(mainAssetMetadata);

  const slugs = getAssetsFromOperations(historyItem);
  const tokensMetadata = useMultipleAssetsMetadata([
    ...new Set([slugs[0], slugs[slugs.length - 1]].filter(s => Boolean(s)))
  ]);

  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem, true), [historyItem]);

  const [showFeeDetails, setShowFeedetails] = useState(true);
  const [expandedTxHistory, setExpandedtxHistory] = useState(false);

  const toggleFeesDropdown = useCallback(() => {
    setShowFeedetails(!showFeeDetails);
  }, [showFeeDetails]);

  const toggleExpandedTxHistory = useCallback(() => {
    setExpandedtxHistory(!expandedTxHistory);
  }, [expandedTxHistory]);

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

  const operStack = useMemo(() => (historyItem ? buildHistoryOperStack(historyItem) : []), [historyItem]);

  const isSwapOperation = historyItem?.type === HistoryItemOpTypeEnum.Swap;

  const moneyDiffForSwap = useMemo(
    () => (isSwapOperation ? getMoneyDiffsForSwap(moneyDiffs) : []),
    [isSwapOperation, moneyDiffs]
  );

  if (!historyItem) return null;

  return (
    <PopupModalWithTitle
      isOpen={isOpen}
      title={
        <div className="flex flex-col items-center gap-2">
          <div
            className={clsx(
              'mt-2',
              isSwapOperation ? 'text-xl leading-6 tracking-tight mb-1 text-white' : 'text-sm text-secondary-white'
            )}
          >
            {HistoryItemOpTypeTexts[historyItem.type]}
          </div>
          {!isSwapOperation && (
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
          )}

          <HistoryTime addedAt={addedAt || historyItem.operations[0]?.addedAt} showFullDate />
        </div>
      }
      portalClassName="history-details-popup"
      headerComponent={<HistoryTokenIcon historyItem={historyItem} size={44} fullSizeAssets />}
      {...props}
    >
      <div className="px-4">
        {isSwapOperation && tokensMetadata && (
          <CardContainer className="mb-6">
            <div className="flex items-center justify-between">
              <IconForSwap token={tokensMetadata[1]} diff={moneyDiffForSwap[1]} status={status} />
              <ParallelArrowsIcon className="w-6 h-6" />
              <IconForSwap token={tokensMetadata[0]} diff={moneyDiffForSwap[0]} status={status} />
            </div>
          </CardContainer>
        )}
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
            <div className="flex items-center">
              <HashChip hash={hash} small showIcon={false} />
              <OpenInExplorerChip hash={hash} alternativeDesign small />
            </div>
          </div>
        </CardContainer>

        {!isSwapOperation && <TxAddressBlock historyItem={historyItem} />}

        <CardContainer className={clsx('text-sm text-white flex flex-col')}>
          <div className="flex justify-between items-start text-base-plus">
            <div className="flex items-center gap-1" onClick={toggleFeesDropdown}>
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
                assetSlug={MAV_TOKEN_SLUG}
                value={`${mumavToTz(fees?.networkFee ?? 0)}`}
                showEqualSymbol={false}
                className="text-base-plus"
                roundingMode={BigNumber.ROUND_CEIL}
                customSymbol="-"
              />

              <div className="text-sm text-secondary-white">
                <span>-{mumavToTz(fees?.networkFee ?? 0).toFixed()}</span>
                &nbsp;
                <span>{mainAssetSymbol}</span>
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
            {showFeeDetails && <Divider color="bg-divider" className="mt-2" />}
            <div className="flex justify-between items-center">
              <span>
                <T id="gasFee" />
              </span>
              <span className="text-secondary-white flex items-center capitalize">
                <span>-{mumavToTz(fees?.gasFee ?? 0).toFixed()}</span>
                &nbsp;
                <span>{mainAssetSymbol}</span>
              </span>
            </div>
            <div className="flex justify-between items-center capitalize">
              <span>
                <T id="storageFee" />
              </span>
              <span className="text-secondary-white">
                <span className="text-secondary-white flex items-center">
                  <span>-{mumavToTz(fees?.storageFee ?? 0).toFixed()}</span>
                  &nbsp;
                  <span>{mainAssetSymbol}</span>
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>
                <T id="burnedFromFees" />
              </span>
              <span className="text-secondary-white">
                <span>-{mumavToTz(burnedFee).toFixed()}</span>
                &nbsp;
                <span>{mainAssetSymbol}</span>
              </span>
            </div>
          </div>
        </CardContainer>

        {operStack.length > 1 && (
          <>
            <h4 className="text-base-plus text-white mt-6 mb-4">
              <T id="transactionDetails" />
            </h4>

            <CardContainer className="text-white flex flex-col">
              {renderTxHistoryDetails(operStack, !expandedTxHistory).map((item, i) => {
                return (
                  <div key={i}>
                    <OpertionStackItem item={item} moneyDiff={moneyDiffs[i]} isTiny />
                    <ListItemDivider />
                  </div>
                );
              })}

              <div className={clsx('flex items-start w-full text-cleft mt-3')}>
                <button
                  className={clsx('flex items-center', 'text-accent-blue hover:underline')}
                  onClick={e => {
                    e.stopPropagation();
                    toggleExpandedTxHistory();
                  }}
                >
                  <T id={expandedTxHistory ? 'showLess' : 'showMore'} />
                </button>
              </div>
            </CardContainer>
          </>
        )}
      </div>
    </PopupModalWithTitle>
  );
};

// helper functions
function renderTxHistoryDetails(operStack: IndividualHistoryItem[], previewOnly: boolean) {
  if (previewOnly) {
    return operStack.slice(0, TX_HISTORY_PREVIEW_IDX);
  }

  return operStack;
}

// helper components
const TxAddressBlock: FC<{ historyItem: UserHistoryItem }> = ({ historyItem }) => {
  const item = historyItem.operations[0];
  const swappedOpItem = historyItem.operations[historyItem.operations.length - 1];

  const getTxOpLabelAndAddress = useMemo(() => {
    switch (historyItem.type) {
      case HistoryItemOpTypeEnum.Delegation:
        const opDelegate = item as HistoryItemDelegationOp;
        return {
          label: HistoryItemTypeLabels[historyItem.type],
          address: opDelegate.newDelegate?.address
        };

      case HistoryItemOpTypeEnum.Origination:
        const opOriginate = item as HistoryItemOriginationOp;
        return {
          label: HistoryItemTypeLabels[historyItem.type],
          address: opOriginate.originatedContract?.address
        };

      case HistoryItemOpTypeEnum.Interaction:
        const opInteract = item as HistoryItemTransactionOp;
        return {
          label: HistoryItemTypeLabels[historyItem.type],
          address: opInteract.destination.address
        };
      case HistoryItemOpTypeEnum.Swap:
        const opSwap = swappedOpItem as HistoryItemTransactionOp;

        return {
          label: HistoryItemTypeLabels[historyItem.type],
          address: opSwap.destination.address
        };

      case HistoryItemOpTypeEnum.TransferFrom:
        const opFrom = item as HistoryItemTransactionOp;
        return {
          label: HistoryItemTypeLabels[historyItem.type],
          address: opFrom.source.address
        };

      case HistoryItemOpTypeEnum.TransferTo:
        const opTo = item as HistoryItemTransactionOp;
        return {
          label: HistoryItemTypeLabels[historyItem.type],
          address: opTo.destination.address
        };
      case HistoryItemOpTypeEnum.Reveal:
        const opReveal = item as HistoryItemTransactionOp;
        return {
          label: HistoryItemTypeLabels[historyItem.type],
          address: opReveal.destination.address
        };

      // Other
      default:
        const opOther = item as HistoryItemOtherOp;
        return {
          label: HistoryItemTypeLabels[historyItem.type],
          address: opOther.destination?.address || opOther.source.address || opOther.hash
        };
    }
  }, [historyItem.type, item, swappedOpItem]);

  return (
    <CardContainer className="mb-6 text-base-plus text-white">
      <span className="mb-2">{getTxOpLabelAndAddress.label}</span>
      <div className="flex items-center gap-3">
        <Identicon
          type="bottts"
          size={24}
          hash={getTxOpLabelAndAddress.address ?? ''}
          className="flex-shrink-0 shadow-xs rounded-full"
        />
        <HashChip hash={getTxOpLabelAndAddress.address ?? ''} small className="text-sm" />
      </div>
    </CardContainer>
  );
};

const IconForSwap: FC<{ token: AssetMetadataBase; diff: MoneyDiff; status: HistoryItemStatus }> = ({
  token,
  diff,
  status
}) => {
  return (
    <div className="flex items-center gap-x-2">
      <img
        className={clsx('rounded-full overflow-hidden bg-white w-8 h-8')}
        src={alterIpfsUrl(token?.thumbnailUri)}
        alt={token?.name}
      />

      <div className="flex flex-col justify-center gap-y-2px">
        <div className="text-white text-base-plus">{token.symbol}</div>
        <MoneyDiffView
          diff={diff.diff}
          assetId={diff.assetSlug}
          pending={status === 'pending'}
          className="flex flex-col items-center"
          moneyClassname="text-base-plus text-white"
          isColored={false}
          showFiatBalance={false}
          showAssetSymbol={false}
        />
      </div>
    </div>
  );
};
