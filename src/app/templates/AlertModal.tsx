import React, { FC } from 'react';

import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { t } from 'lib/i18n';

import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from './PopupModalWithTitle';

export type AlertModalProps = PopupModalWithTitlePropsProps;

const AlertModal: FC<AlertModalProps> = props => {
  const { onRequestClose, children, ...restProps } = props;

  return (
    <PopupModalWithTitle {...restProps} contentPosition="center" onRequestClose={onRequestClose}>
      <div className="flex flex-col px-4">
        <div className="mb-8 text-base-plus text-white">{children}</div>
        <div className="flex justify-end">
          <ButtonRounded size="big" fill type="button" onClick={onRequestClose}>
            {t('ok')}
          </ButtonRounded>
        </div>
      </div>
    </PopupModalWithTitle>
  );
};

export default AlertModal;
