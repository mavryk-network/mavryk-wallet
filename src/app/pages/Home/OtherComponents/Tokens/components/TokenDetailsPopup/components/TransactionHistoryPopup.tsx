import React, { FC } from 'react';

import { HashChip, Identicon } from 'app/atoms';
import { CardContainer } from 'app/atoms/CardContainer';
import { AssetIcon } from 'app/templates/AssetIcon';
import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { T, t } from 'lib/i18n';

export const TransactionHistoryPopup: FC<PopupModalWithTitlePropsProps> = ({ isOpen, ...props }) => {
  return (
    <PopupModalWithTitle
      isOpen={isOpen}
      title={
        <div className="flex items-center gap-1">
          <span className="text-xs text-secondary-white">Recevied</span>
        </div>
      }
      portalClassName="token-details-popup"
      headerComponent={<AssetIcon assetSlug={'tez'} className="rounded-full" style={{ width: 44, height: 44 }} />}
      {...props}
    >
      <div className="px-4">
        <CardContainer className="text-base-plus mb-6 text-white">
          <div className="flex items-center justify-between">
            <T id="status" />
            <span className="text-primary-success mb-2">Applied</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Transaction ID</span>
            <HashChip hash="tz1fXRwGcgoz81Fsksx9L2rVD5wE6CpTMkLz" small />
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
