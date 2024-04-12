import React, { FC, useMemo } from 'react';

import clsx from 'clsx';

import CustomPopup, { CustomPopupProps } from 'app/atoms/CustomPopup';
import { useAppEnv } from 'app/env';
import { ReactComponent as SuccessIcon } from 'app/icons/m_chevron-down.svg';
import { BgImageLayout } from 'app/layouts/BgImageLayout/BgImageLayout';
import PageLayout from 'app/layouts/PageLayout';
import { ButtonLink } from 'app/molecules/ButtonLink/ButtonLink';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { TID, T } from 'lib/i18n';
import { useLocation } from 'lib/woozie';

import { successContentData } from './content';
import { SuccessScreenSelectors } from './SuccessScreen.selectors';

export type SuccessStateType = {
  pageTitle: TID;
  subHeader: TID;
  description?: TID;
  contentID?: string;
  btnText: TID;
  btnLink?: string;
  contentId?: keyof typeof successContentData;
  contentIdFnProps?: any;
};

const defaultStateValues: SuccessStateType = {
  pageTitle: 'operations',
  subHeader: 'success',
  description: undefined,
  contentId: undefined,
  contentIdFnProps: undefined,
  btnText: 'goToMain',
  btnLink: '/'
};

export const SuccessScreen = () => {
  const { popup } = useAppEnv();
  const loc = useLocation();
  const state: SuccessStateType = { ...defaultStateValues, ...loc.state };

  const bgSrc = useMemo(() => (popup ? '/misc/success-bg.webp' : '/misc/success-bg-full-view.webp'), [popup]);
  const memoizedContainerStyle = useMemo(() => ({ padding: 0 }), []);
  const memoizedContentPaperStyle = useMemo(() => ({ height: 664 }), []);

  return (
    <PageLayout
      pageTitle={
        <>
          <T id={state.pageTitle} />
        </>
      }
      isTopbarVisible={false}
      contentContainerStyle={memoizedContainerStyle}
      contentPaperStyle={memoizedContentPaperStyle}
    >
      <BgImageLayout src={bgSrc} className="flex justify-center items-center flex-1 h-full">
        <div className={clsx('text-white w-full py-8 flex flex-col items-center gap-6', popup ? 'px-4' : 'px-20')}>
          {/* icon */}
          <div className="w-11 h-11 rounded-full bg-accent-blue flex items-center justify-center">
            <SuccessIcon className="w-6 h-auto stroke-current" />
          </div>
          {/* content */}
          <section aria-label="success-message ">
            <div className="text-xl leading-5 text-center mb-2">
              <T id={state.subHeader} />!
            </div>

            {state.description && (
              <div className="text-sm text-center mb-2">
                <T id={state.description} />
              </div>
            )}
            {state.contentId && (
              <div className="text-sm text-center mb-2">
                {successContentData[state.contentId]({ ...state.contentIdFnProps })}
              </div>
            )}
          </section>
          <div className="w-full">
            <ButtonLink linkTo={state.btnLink ?? '/'} testID={SuccessScreenSelectors.buttonSuccess} replace>
              <ButtonRounded size="big" fill className="w-full">
                <T id={state.btnText} />
              </ButtonRounded>
            </ButtonLink>
          </div>
        </div>
      </BgImageLayout>
    </PageLayout>
  );
};

export const SuccesModal: FC<CustomPopupProps> = ({ ...props }) => {
  return (
    <CustomPopup {...props} className="w-full">
      <SuccessScreen />
    </CustomPopup>
  );
};
