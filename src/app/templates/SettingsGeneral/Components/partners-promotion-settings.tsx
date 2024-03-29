import React, { ChangeEvent, FC } from 'react';

import { useDispatch } from 'react-redux';

import { Switcher } from 'app/atoms/Switcher';
import { togglePartnersPromotionAction } from 'app/store/partners-promotion/actions';
import { useShouldShowPartnersPromoSelector } from 'app/store/partners-promotion/selectors';
import { T, t } from 'lib/i18n';
import { useConfirm } from 'lib/ui/dialog';

export const PartnersPromotionSettings: FC = () => {
  const dispatch = useDispatch();
  const confirm = useConfirm();

  const shouldShowPartnersPromo = useShouldShowPartnersPromoSelector();

  const handleHidePromotion = async (toChecked: boolean) => {
    const confirmed = await confirm({
      title: t('closePartnersPromotion'),
      children: t('closePartnersPromoConfirm'),
      comfirmButtonText: t('disable')
    });

    if (confirmed) {
      dispatch(togglePartnersPromotionAction(toChecked));
    }
  };

  const handleShowPromotion = async (toChecked: boolean) => {
    const confirmed = await confirm({
      title: t('enablePartnersPromotionConfirm'),
      children: t('enablePartnersPromotionDescriptionConfirm'),
      comfirmButtonText: t('enable')
    });

    if (confirmed) {
      dispatch(togglePartnersPromotionAction(toChecked));
    }
  };

  const togglePartnersPromotion = (toChecked: boolean, event: ChangeEvent<HTMLInputElement>) => {
    event?.preventDefault();

    return toChecked ? handleShowPromotion(toChecked) : handleHidePromotion(toChecked);
  };

  return (
    <div className="flex items-start justify-between gap-4 w-full">
      <label className="mb-4 leading-tight flex flex-col" htmlFor="shouldShowPartnersPromo">
        <span className="text-base-plus text-white">
          <T id="partnersPromoSettings" />
        </span>

        <span className="mt-1 text-xs text-secondary-white">
          <span>
            <T id="partnersPromoDescription" />
          </span>
        </span>
      </label>
      <div className="w-auto">
        <Switcher on={shouldShowPartnersPromo} onChange={togglePartnersPromotion} />
      </div>
    </div>
  );
};
