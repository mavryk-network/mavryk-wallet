import React, { FC, useCallback } from 'react';

import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { MAVEN_METADATA } from 'lib/metadata';
import { useTezos } from 'lib/temple/front';
import { atomsToTokens } from 'lib/temple/helpers';
import { navigate } from 'lib/woozie';

type UnlockPopupProps = {
  opened: boolean;
  close: () => void;
  stakedBalance: number;
};

export const UnlockPopup: FC<UnlockPopupProps> = ({ opened, close, stakedBalance }) => {
  const { popup } = useAppEnv();
  const tezos = useTezos();
  const [error, setError] = React.useState<string | null>(null);

  const handleUnlock = useCallback(async () => {
    try {
      close();

      await tezos.wallet
        .unstake({
          amount: atomsToTokens(stakedBalance, MAVEN_METADATA.decimals).toNumber()
        })
        .send();

      navigate<SuccessStateType>('/success', undefined, {
        pageTitle: 'unlock',
        subHeader: 'success',
        description: 'unlockSuccessMsg',
        btnText: 'backToValidator',
        btnLink: '/stake'
      });
    } catch (err) {
      console.error(err);
      setError(err.message ?? 'Unable to unlock your stake balance!');
    }
  }, [close, stakedBalance, tezos.wallet]);

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={<>Unlock Your Stake</>}
      portalClassName="re-delegate-popup"
    >
      <div className={classNames(popup ? 'px-4' : 'px-6')}>
        <div className={classNames('flex flex-col text-white ', popup ? 'text-sm' : 'text-base')}>
          Unlocking staked funds initiates a 4 cycles (12 days) waiting period. During this time, your assets remain
          delegated to your current validator and are inaccessible for withdrawal.
        </div>
        <div className={classNames('mt-8 grid grid-cols-2 gap-4 justify-center', !popup && 'px-12')}>
          <ButtonRounded size="big" fill={false} onClick={close}>
            <T id="cancel" />
          </ButtonRounded>
          <ButtonRounded size="big" fill onClick={handleUnlock}>
            <T id="unlock" />
          </ButtonRounded>
        </div>
        {error && <div className="text-primary-error mt-4 text-center text-base">{error}</div>}
      </div>
    </PopupModalWithTitle>
  );
};
