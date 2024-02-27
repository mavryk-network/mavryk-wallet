import React, { FC, useMemo } from 'react';

import { HashChip, Identicon } from 'app/atoms';
import { CardContainer } from 'app/atoms/CardContainer';
import { AssetIcon } from 'app/templates/AssetIcon';
import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { UserHistoryItem } from 'lib/temple/history';
import { HistoryItemOpTypeTexts } from 'lib/temple/history/consts';
import { buildHistoryMoneyDiffs } from 'lib/temple/history/helpers';

import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { MoneyDiffView } from './MoneyDiffView';

export type HistoryDetailsPopupProps = PopupModalWithTitlePropsProps & {
  historyItem: UserHistoryItem | null;
};

export const HistoryDetailsPopup: FC<HistoryDetailsPopupProps> = ({ historyItem, isOpen, ...props }) => {
  const { hash = '', addedAt = '', status = 'skipped' } = historyItem ?? {};

  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem), [historyItem]);
  if (!historyItem) return null;

  return (
    <PopupModalWithTitle
      isOpen={isOpen}
      title={
        <div className="flex flex-col items-center gap-4">
          <div className="text-xs text-secondary-white">{HistoryItemOpTypeTexts[historyItem.type]}</div>
          <div className="">
            {moneyDiffs.map(({ assetSlug, diff }, i) => (
              <MoneyDiffView key={i} assetId={assetSlug} diff={diff} pending={status === 'pending'} />
            ))}
          </div>

          <HistoryTime addedAt={addedAt} />
        </div>
      }
      portalClassName="token-details-popup"
      headerComponent={<HistoryTokenIcon size={44} slug="tez" />}
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
              hash="tz1fXRwGcgoz81Fsksx9L2rVD5wE6CpTMkLz"
              className="flex-shrink-0 shadow-xs rounded-full"
            />
            <HashChip hash="tz1fXRwGcgoz81Fsksx9L2rVD5wE6CpTMkLz" small />
          </div>
        </CardContainer>
      </div>
    </PopupModalWithTitle>
  );
};
