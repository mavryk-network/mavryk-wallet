import React, { FC, useCallback } from 'react';

import { isDefined } from '@rnw-community/shared';
import classNames from 'clsx';

import { Anchor, Button } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { useActivePromotion, useIsNewPromotionAvailable } from 'app/hooks/use-advertising-promotion.query';
import ContentContainer from 'app/layouts/ContentContainer';
import { T } from 'lib/i18n/react';
import { uiStore } from 'lib/store/zustand/ui.store';
import { useTempleClient } from 'lib/temple/front';

export const AdvertisingOverlay: FC = () => {
  const { popup } = useAppEnv();
  const { ready } = useTempleClient();
  const activePromotion = useActivePromotion();
  const isNewPromotionAvailable = useIsNewPromotionAvailable();

  const popupClassName = popup ? 'inset-0' : 'top-1/2 left-1/2 transform -translate-y-1/2 -translate-x-1/2';
  const analyticsEventPrefix = `${activePromotion?.name}_${popup ? 'POPUP' : 'FULLPAGE'}`;

  const handleSkipPress = useCallback(() => {
    uiStore.getState().setLastSeenPromotionName(activePromotion?.name);
  }, [activePromotion?.name]);
  const handleBannerPress = useCallback(() => {
    uiStore.getState().setLastSeenPromotionName(activePromotion?.name);
  }, [activePromotion?.name]);

  return ready && isNewPromotionAvailable && isDefined(activePromotion) ? (
    <>
      <Button
        className={'fixed left-0 right-0 top-0 bottom-0 opacity-20 bg-gray-700 z-50'}
        onClick={handleSkipPress}
        testID={`${analyticsEventPrefix}_SKIP`}
      />

      <ContentContainer className={classNames('fixed z-50 max-h-full overflow-y-auto', popupClassName)} padding={false}>
        <Anchor
          className="flex items-center justify-center m-auto"
          style={{
            width: popup ? 375 : 600,
            height: popup ? 600 : 700,
            borderRadius: popup ? 0 : 4,
            backgroundColor: '#E5F2FF'
          }}
          href={activePromotion.url}
          onClick={handleBannerPress}
          testID={`${analyticsEventPrefix}_BANNER`}
          treatAsButton={true}
        >
          <img
            alt={activePromotion.name}
            src={popup ? activePromotion.popupBannerUrl : activePromotion.fullPageBannerUrl}
          />
        </Anchor>

        <Button
          className={classNames(
            'absolute top-0 right-3 px-3 py-2 hover:opacity-50',
            'font-aeonik font-medium text-sm text-white self-end mt-3',
            'rounded bg-blue-500',
            popup ? 'mr-1' : 'mr-6'
          )}
          onClick={handleSkipPress}
          testID={`${analyticsEventPrefix}_SKIP`}
        >
          <T id="skipAd" />
        </Button>
      </ContentContainer>
    </>
  ) : null;
};
