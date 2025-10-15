import React, { FC, useCallback, useEffect, useState } from 'react';

import clsx from 'clsx';

import { Alert } from 'app/atoms';
import { getErrorMsgByCode } from 'app/consts/errorCodes';
import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { FooterSocials } from 'app/templates/Socials/FooterSocials';
import { T, TID, t } from 'lib/i18n';
import { useAccount, useChainId, useNetwork, useTempleClient } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { navigate } from 'lib/woozie';

import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import { signKYCAction } from './utils/tezosSigner';
import VerificationForm from './VerificationForm/VerificationForm';

export const ProVersion: FC = () => {
  const { isKYC = false, type } = useAccount();
  const [navigateToForm, setNavigateToForm] = useState(isKYC);
  const { fullPage, popup } = useAppEnv();

  useEffect(() => {
    if (type === TempleAccountType.WatchOnly) {
      navigate('/');
    }
  }, [type]);

  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={isKYC ? <T id="addressVerification" /> : <T id="proVersion" />}
      removePaddings={popup}
    >
      <div className={clsx('h-full flex-1 flex flex-col', !fullPage && 'pb-8')}>
        {navigateToForm ? <VerificationForm /> : <GetProVersionScreen setNavigateToForm={setNavigateToForm} />}
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
  const { updateAccountKYCStatus } = useTempleClient();
  const { popup } = useAppEnv();
  const { rpcBaseURL: rpcUrl } = useNetwork();
  const { publicKeyHash } = useAccount();
  const chainId = useChainId();
  const [formState, setFormState] = useState<FormData>({
    submitting: false,
    error: null
  });

  const handleBtnClick = useCallback(async () => {
    try {
      setFormState({ ...formState, submitting: true });

      // make account a KYC account
      await signKYCAction(rpcUrl, publicKeyHash, chainId);

      setFormState({ ...formState, submitting: false });
      setNavigateToForm(false);

      await updateAccountKYCStatus(publicKeyHash, true);

      navigate<SuccessStateType>('/success', undefined, {
        pageTitle: 'proVersion',
        btnText: 'goToMain',
        description: 'mavopolySuccessMsg',
        subHeader: 'success',
        secondaryBtnLink: '/pro-version',
        bottomDescription: 'addressVerificationMsg',
        contentId: 'verifySuccess',
        secondaryBtnText: 'continueToVerifyAddressesMsg'
      });
    } catch (e: any) {
      // show err on ui
      setFormState({ ...formState, error: getErrorMsgByCode(e.message) });
    }
  }, [formState, publicKeyHash, rpcUrl, setNavigateToForm, updateAccountKYCStatus, chainId]);

  return (
    <div className={clsx(popup && 'px-4 py-4', popup && formState?.error && 'overflow-y-scroll')}>
      <div className="text-base text-white text-center">
        <T id="joinMavryk" />
      </div>
      <div className="bg-primary-card rounded-2xl-plus py-6 px-4 flex flex-col gap-6 my-6">
        {proVersionList.map(item => (
          <UnfamiliarListItem key={item.i18nKey} {...item} />
        ))}
      </div>

      {formState?.error && (
        <Alert
          type="error"
          title="Error"
          description={formState.error ?? t('smthWentWrong')}
          className="my-4"
          autoFocus
        />
      )}

      <ButtonRounded
        isLoading={formState.submitting}
        onClick={handleBtnClick}
        size="big"
        className={clsx('w-full')}
        fill
      >
        <T id="getPro" />
      </ButtonRounded>

      <section className={clsx('flex flex-col items-center', popup ? 'mt-8' : 'mt-17')}>
        <div className="mb-3 text-sm text-white text-center">
          <T id="aboutFooterDescription" />
        </div>
        <FooterSocials />
      </section>
    </div>
  );
};
