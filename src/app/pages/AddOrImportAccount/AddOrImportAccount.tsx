import React, { FC } from 'react';

import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { T, TID } from 'lib/i18n';
import { Link } from 'lib/woozie';

type BtnRoute = {
  i18nKey: TID;
  linkTo: string;
};

const buttonRoutes: BtnRoute[] = [
  {
    i18nKey: 'addNewAccount',
    linkTo: '/create-account'
  },
  {
    i18nKey: 'importAccount',
    linkTo: '/import-account'
  },
  {
    i18nKey: 'restoreAccount',
    linkTo: '/import-wallet'
  }
];

export const AddOrImportAccount: FC = () => {
  return (
    <PageLayout
      pageTitle={
        <>
          <T id="addOrImportAccount" />
        </>
      }
      isTopbarVisible={false}
    >
      <div className="w-full max-w-sm mx-auto h-full flex flex-col justify-start pb-8">
        <div className="text-base-plus text-white mb-20">
          <T id="addOrImportAccountDescfiption" />
        </div>
        <div className="flex flex-col gap-4 items-stretch">
          {buttonRoutes.map(btn => (
            <Link to={btn.linkTo} key={btn.linkTo} className="w-full">
              <ButtonRounded size="big" fill={false} className="w-full">
                <T id={btn.i18nKey} />
              </ButtonRounded>
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};
