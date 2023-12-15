import React from 'react';

import { BgImageLayout } from 'app/layouts/BgImageLayout/BgImageLayout';
import PageLayout from 'app/layouts/PageLayout';
import { TID, T } from 'lib/i18n';
import { useLocation } from 'lib/woozie';

export type SuccessStateType = {
  pageTitle: TID;
  subHeader: TID;
  description?: TID;
  btnText: TID;
};

const defaultStateValues: SuccessStateType = {
  pageTitle: 'operations',
  subHeader: 'success',
  description: undefined,
  btnText: 'goToMain'
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
      // 56px is the height of the topbar with title
      contentContainerStyle={{ height: 'calc(100vh - 56px)', padding: 0 }}
      isTopbarVisible={false}
    >
      <BgImageLayout src="/misc/UnlockBg.png" className="flex justify-center items-center">
        <div className=" text-white w-full px-4 py-8">Content</div>
      </BgImageLayout>
    </PageLayout>
  );
};
