import React from 'react';

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
  contentIdFnProps: any;
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
  const loc = useLocation();
  const state: SuccessStateType = { ...defaultStateValues, ...loc.state };

  return (
    <PageLayout
      pageTitle={
        <>
          <T id={state.pageTitle} />
        </>
      }
      isTopbarVisible={false}
      contentContainerStyle={{ padding: 0 }}
    >
      <BgImageLayout src="/misc/success-bg.webp" className="flex justify-center items-center">
        <div className=" text-white w-full px-4 py-8 flex flex-col items-center gap-6">
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
            <ButtonLink linkTo={state.btnLink ?? '/'} testID={SuccessScreenSelectors.buttonSuccess}>
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
