import React, { FC, useCallback } from 'react';

import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { delay } from 'lib/utils';

type UnlockFisrtPopupProps = {
  opened: boolean;
  close: () => void;
  openUnlockPopup: () => void;
};

export const UnlockFisrtPopup: FC<UnlockFisrtPopupProps> = ({ opened, close, openUnlockPopup }) => {
  const { popup } = useAppEnv();

  const proceedToUnlock = useCallback(async () => {
    close();
    await delay();
    openUnlockPopup();
  }, [close, openUnlockPopup]);

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={<>Unlock Your Stake First</>}
      portalClassName="re-delegate-popup"
    >
      <div className={classNames(popup ? 'px-4' : 'px-6')}>
        <div className={classNames('flex flex-col text-white ', popup ? 'text-sm' : 'text-base')}>
          Before re-delegating, you need to unlock your assets first. After the X-day unlock period, you can choose a
          new validator.
        </div>
        <div className={classNames('mt-8 grid grid-cols-2 gap-4 justify-center', !popup && 'px-12')}>
          <ButtonRounded size="big" fill={false} onClick={close}>
            <T id="cancel" />
          </ButtonRounded>
          <ButtonRounded size="big" fill onClick={proceedToUnlock}>
            Proceed to Unlock
          </ButtonRounded>
        </div>
      </div>
    </PopupModalWithTitle>
  );
};
