import React, { FC, useCallback, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { FooterSocials } from 'app/templates/Socials/FooterSocials';
import { T, TID } from 'lib/i18n';
import { delay } from 'lib/utils';
import { navigate } from 'lib/woozie';

import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import VerificationForm from './VerificationForm/VerificationForm';

export const ProVersion: FC = () => {
  console.log('hello there');
  // TODO fetch if address is verified

  const isAddressVerified = false;
  const [navigateToForm, setNavigateToForm] = useState(isAddressVerified);
  const [toolbarRightSidedComponent, setToolbarRightSidedComponent] = useState<JSX.Element | null>(null);
  const { fullPage, popup } = useAppEnv();

  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={<T id="proVersion" />}
      removePaddings={popup}
      RightSidedComponent={toolbarRightSidedComponent}
    >
      <div className={clsx('h-full flex-1 flex flex-col', !fullPage && 'pb-8')}>
        {navigateToForm ? (
          <VerificationForm setToolbarRightSidedComponent={setToolbarRightSidedComponent} />
        ) : (
          <GetProVersionScreen setNavigateToForm={setNavigateToForm} />
        )}
      </div>
    </PageLayout>
  );
};

type UnfamiliarListItemType = {
  content: string;
  i18nKey: TID;
};

const proVersionList: UnfamiliarListItemType[] = [
  {
    content: '🔂',
    i18nKey: 'proSreenItem1'
  },
  {
    content: '🏨',
    i18nKey: 'proSreenItem2'
  },
  {
    content: '💸',
    i18nKey: 'proSreenItem3'
  },
  {
    content: '🔓',
    i18nKey: 'proSreenItem4'
  }
];

const UnfamiliarListItem: FC<UnfamiliarListItemType> = ({ content, i18nKey }) => {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex text-2xl`}>{content}</span>
      <span className="text-sm text-white">
        <T id={i18nKey} />
      </span>
    </div>
  );
};

type GetProVersionScreenProps = {
  setNavigateToForm: (value: boolean) => void;
};

type FormData = {
  submitting: boolean;
  error?: null | string;
};

const GetProVersionScreen: FC<GetProVersionScreenProps> = ({ setNavigateToForm }) => {
  const { popup } = useAppEnv();
  const [formState, setFormState] = useState<FormData>({
    submitting: false,
    error: null
  });

  const handleBtnClick = useCallback(async () => {
    try {
      // contract call to set current address as pro
      // skip delegate onboarding screen
      setFormState({ ...formState, submitting: true });
      await delay(3_000);
      setFormState({ ...formState, submitting: false });
      setNavigateToForm(false);

      navigate<SuccessStateType>('/success', undefined, {
        pageTitle: 'proVersion',
        btnText: 'goToMavopoly',
        description: 'mavopolySuccessMsg',
        subHeader: 'success'
      });
    } catch (e) {
      console.log(e);
      // show err on ui
      setFormState({ ...formState, error: e.message || 'Something went wrong' });
    }
  }, [formState, setNavigateToForm]);

  return (
    <div className={clsx(popup && 'px-4 pt-4')}>
      <div className="text-base text-white text-center">
        <T id="joinMavryk" />
      </div>
      <div className="bg-primary-card rounded-2xl-plus py-6 px-4 flex flex-col gap-6 my-6">
        {proVersionList.map(item => (
          <UnfamiliarListItem key={item.i18nKey} {...item} />
        ))}
      </div>
      <section className="flex flex-col items-center">
        <div className="mb-3 text-sm text-white text-center">
          <T id="aboutFooterDescription" />
        </div>
        <FooterSocials />
      </section>
      <ButtonRounded
        isLoading={formState.submitting}
        onClick={handleBtnClick}
        size="big"
        className={clsx('w-full', popup ? 'mt-40px' : 'mt-18')}
        fill
      >
        <T id="getPro" />
      </ButtonRounded>
      {formState?.error && <div className="mt-2 text-primary-error textbase-plus">{formState.error}</div>}
    </div>
  );
};
