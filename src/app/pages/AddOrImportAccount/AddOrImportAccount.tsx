import React, { FC } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
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
  const { popup } = useAppEnv();
  return (
    <PageLayout
      pageTitle={
        <>
          <T id="addOrImportAccount" />
        </>
      }
      isTopbarVisible={false}
    >
      <div
        className={clsx(
          'w-full mx-auto h-full flex flex-col justify-start pb-8',
          popup ? 'max-w-sm' : 'max-w-screen-xxs'
        )}
      >
        <div className="text-sm text-white mb-20">
          <T id="addOrImportAccountDescfiption" />
        </div>
        <div className="flex flex-col gap-4 items-stretch">
          {buttonRoutes.map(btn => (
            <Link to={btn.linkTo} key={btn.linkTo} className="w-full">
              <ButtonRounded size="big" fill={false} className="w-full capitalize">
                <T id={btn.i18nKey} />
              </ButtonRounded>
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};
