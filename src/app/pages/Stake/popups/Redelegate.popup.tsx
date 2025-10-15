import React, { FC } from 'react';

import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';

type RedelegatePopupProps = {
  opened: boolean;
  close: () => void;
  handleReDelegateNavigation: () => void;
};

export const RedelegatePopup: FC<RedelegatePopupProps> = ({ opened, close, handleReDelegateNavigation }) => {
  const { popup } = useAppEnv();
  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={<T id="reDelegateToNewValidator" />}
      portalClassName="re-delegate-popup"
    >
      <div className={classNames(popup ? 'px-4' : 'px-6')}>
        <div className={classNames('flex flex-col text-white ', popup ? 'text-sm' : 'text-base')}>
          <T id="reDelegateToNewValidatorDescr" />
        </div>
        <div className={classNames('mt-8 grid grid-cols-2 gap-4 justify-center', !popup && 'px-12')}>
          <ButtonRounded size="big" fill={false} onClick={close}>
            <T id="cancel" />
          </ButtonRounded>
          <ButtonRounded size="big" fill onClick={handleReDelegateNavigation}>
            <T id="reDelegate" />
          </ButtonRounded>
        </div>
      </div>
    </PopupModalWithTitle>
  );
};
