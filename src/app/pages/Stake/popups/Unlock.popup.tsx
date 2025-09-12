import React, { FC, useCallback } from 'react';

import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { navigate } from 'lib/woozie';

type UnlockPopupProps = {
  opened: boolean;
  close: () => void;
};

export const UnlockPopup: FC<UnlockPopupProps> = ({ opened, close }) => {
  const { popup } = useAppEnv();

  const handleUnlock = useCallback(async () => {
    close();
    navigate('/unlock-stake');
  }, [close]);

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={<T id="unlockYourStake" />}
      portalClassName="re-delegate-popup"
    >
      <div className={classNames(popup ? 'px-4' : 'px-6')}>
        <div className={classNames('flex flex-col text-white ', popup ? 'text-sm' : 'text-base')}>
          <T id="unlockYourStakeDesc" />
        </div>
        <div className={classNames('mt-8 grid grid-cols-2 gap-4 justify-center', !popup && 'px-12')}>
          <ButtonRounded size="big" fill={false} onClick={close}>
            <T id="cancel" />
          </ButtonRounded>
          <ButtonRounded size="big" fill onClick={handleUnlock}>
            <T id="proceedToUnlock" />
          </ButtonRounded>
        </div>
      </div>
    </PopupModalWithTitle>
  );
};
