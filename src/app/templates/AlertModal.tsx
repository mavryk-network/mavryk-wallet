import React, { FC } from 'react';

import { ButtonRounded } from 'app/molecules/ButtonRounded';
import ModalWithTitle, { ModalWithTitleProps } from 'app/templates/ModalWithTitle';
import { t } from 'lib/i18n';

export type AlertModalProps = ModalWithTitleProps;

const AlertModal: FC<AlertModalProps> = props => {
  const { onRequestClose, children, ...restProps } = props;

  return (
    <ModalWithTitle {...restProps} onRequestClose={onRequestClose}>
      <div className="flex flex-col">
        <div className="mb-8">{children}</div>
        <div className="flex justify-end">
          <ButtonRounded size="big" fill type="button" onClick={onRequestClose}>
            {t('ok')}
          </ButtonRounded>
        </div>
      </div>
    </ModalWithTitle>
  );
};

export default AlertModal;
