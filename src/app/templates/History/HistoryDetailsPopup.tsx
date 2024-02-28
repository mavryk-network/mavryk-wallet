import React, { FC, useMemo } from 'react';

import { HashChip, Identicon } from 'app/atoms';
import { CardContainer } from 'app/atoms/CardContainer';
import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { UserHistoryItem } from 'lib/temple/history';
import { HistoryItemOpTypeTexts } from 'lib/temple/history/consts';
import { buildHistoryMoneyDiffs } from 'lib/temple/history/helpers';

import { MoneyDiffView } from '../activity/MoneyDiffView';
import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { toHistoryTokenSlug } from './utils';

export type HistoryDetailsPopupProps = PopupModalWithTitlePropsProps & {
  historyItem: UserHistoryItem | null;
};

export const HistoryDetailsPopup: FC<HistoryDetailsPopupProps> = ({ historyItem, isOpen, ...props }) => {
  const { hash = '', addedAt = '', status = 'skipped' } = historyItem ?? {};

  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem), [historyItem]);
  if (!historyItem) return null;

  const assetslug = toHistoryTokenSlug(historyItem);
  return (
    <PopupModalWithTitle
      isOpen={isOpen}
      title={
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-secondary-white">{HistoryItemOpTypeTexts[historyItem.type]}</div>
          <div className="flex flex-col">
            {moneyDiffs.map(({ assetSlug, diff }, i) => (
              <MoneyDiffView
                key={i}
                assetId={assetSlug}
                diff={diff}
                pending={status === 'pending'}
                className="flex flex-col items-center"
                moneyClassname="text-lg"
              />
            ))}
          </div>

          <HistoryTime addedAt={addedAt || historyItem.operations[0]?.addedAt} />
        </div>
      }
      portalClassName="token-details-popup"
      headerComponent={<HistoryTokenIcon transactionType={historyItem.type} size={44} slug={assetslug} />}
      {...props}
    >
      <div className="px-4">
        <CardContainer className="text-base-plus mb-6 text-white">
          <div className="flex items-center justify-between">
            <T id="status" />
            <span className="text-primary-success mb-2 capitalize">{status}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Transaction ID</span>
            <HashChip hash={hash} small />
          </div>
        </CardContainer>

        <CardContainer className="mb-6 text-base-plus text-white">
          <span className="mb-2">Received from</span>
          <div className="flex items-center gap-3">
            <Identicon
              type="bottts"
              size={24}
              hash={historyItem.operations[0]?.source.address ?? ''}
              className="flex-shrink-0 shadow-xs rounded-full"
            />
            <HashChip hash={historyItem.operations[0]?.source.address ?? ''} small />
          </div>
        </CardContainer>

        <CardContainer className="text-base-plus text-white flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span>Network Fees</span>
            <span>-$1.88</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Gas Fee</span>
            <span className="text-secondary-white">-0.02 MVRK</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Storage Fee</span>
            <span className="text-secondary-white">-0.08 MVRK</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Burned From Fees 🔥</span>
            <span className="text-secondary-white">-0.09 MVRK</span>
          </div>
        </CardContainer>
      </div>
    </PopupModalWithTitle>
  );
};
