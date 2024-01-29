import React, { FC } from 'react';

import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';

type TokenDetailsPopupProps = {
  assetSlug: string;
} & PopupModalWithTitlePropsProps;

export const TokenDetailsPopup: FC<TokenDetailsPopupProps> = ({ assetSlug, isOpen, ...rest }) => {
  return (
    <PopupModalWithTitle
      isOpen={isOpen}
      title={<T id="networkSelect" />}
      portalClassName="token-details-popup"
      {...rest}
    >
      <TokenDetailsPopupContent assetSlug={assetSlug} />
    </PopupModalWithTitle>
  );
};

type TokenDetailsPopupContentProps = {
  assetSlug: string;
};

const TokenDetailsPopupContent: FC<TokenDetailsPopupContentProps> = ({ assetSlug }) => {
  return <div className="text-white text-bae-plus">{assetSlug}</div>;
};
