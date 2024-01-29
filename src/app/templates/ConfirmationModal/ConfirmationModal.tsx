import React, { FC } from 'react';

import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { t } from 'lib/i18n';

import { ConfirmatonModalSelectors } from './ConfirmatonModal.selectors';

export interface ConfirmationModalProps extends PopupModalWithTitlePropsProps {
  onConfirm: () => void;
  comfirmButtonText?: string;
}

const ConfirmationModal: FC<ConfirmationModalProps> = props => {
  const { onRequestClose, children, onConfirm, comfirmButtonText = t('ok'), ...restProps } = props;

  return (
    <PopupModalWithTitle {...restProps} onRequestClose={onRequestClose}>
      <div className="px-4">
        <div className="my-11 text-white text-sm text-center">{children}</div>
        <div className="grid grid-cols-2 gap-x-3">
          <ButtonRounded
            size="big"
            fill={false}
            onClick={onRequestClose}
            testID={ConfirmatonModalSelectors.cancelButton}
          >
            {t('cancel')}
          </ButtonRounded>
          <ButtonRounded
            size="big"
            className="capitalize"
            type="button"
            onClick={onConfirm}
            testID={ConfirmatonModalSelectors.okButton}
          >
            {comfirmButtonText}
          </ButtonRounded>
        </div>
      </div>
    </PopupModalWithTitle>
  );
};

export default ConfirmationModal;
