import React, { FC, useCallback, useState } from 'react';

import { TezosToolkit } from '@mavrykdynamics/taquito';
import { InMemorySigner } from '@mavrykdynamics/taquito-signer';
import clsx from 'clsx';

import { Alert } from 'app/atoms';
import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { FooterSocials } from 'app/templates/Socials/FooterSocials';
import { EnvVars } from 'lib/env';
import { T, TID } from 'lib/i18n';
import { KYC_CONTRACT } from 'lib/route3/constants';
import { loadContract } from 'lib/temple/contract';
import { useAccount, useNetwork } from 'lib/temple/front';
import { navigate } from 'lib/woozie';

import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import VerificationForm from './VerificationForm/VerificationForm';

const { SUPER_ADMIN_PRIVATE_KEY } = EnvVars;

export const ProVersion: FC = () => {
  // TODO fetch if address is verified
  const isAddressVerified = false;
  const [navigateToForm, setNavigateToForm] = useState(isAddressVerified);
  const { fullPage, popup } = useAppEnv();

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<T id="addressVerification" />} removePaddings={popup}>
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
  const { popup } = useAppEnv();
  const { rpcBaseURL: rpcUrl } = useNetwork();
  const { publicKeyHash } = useAccount();
  const [formState, setFormState] = useState<FormData>({
    submitting: false,
    error: null
  });

  const handleBtnClick = useCallback(async () => {
    try {
      // contract call to set current address as pro
      // skip delegate onboarding screen
      setFormState({ ...formState, submitting: true });

      const tezos = signerTezos(rpcUrl);

      const contract = await loadContract(tezos, KYC_CONTRACT);

      // const { country, regionName } = await getGeoLocation();

      const setMemberAction = 'addMember';

      const memberList = [
        {
          memberAddress: publicKeyHash,
          country: 'japan',
          region: 'asia',
          investorType: 'institution'
        }
      ];

      // debugger;

      await contract.methods.setMember(setMemberAction, memberList).send();

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
  }, [formState, publicKeyHash, rpcUrl, setNavigateToForm]);

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
    </div>
  );
};

const signerTezos = (rpcUrl: string) => {
  if (!rpcUrl) {
    throw new Error('No RPC_URL defined.');
  }

  const TezToolkit = new TezosToolkit(rpcUrl);

  if (!SUPER_ADMIN_PRIVATE_KEY) {
    throw new Error('No FAUCET_PRIVATE_KEY defined.');
  }

  // Create signer
  TezToolkit.setProvider({
    signer: new InMemorySigner(SUPER_ADMIN_PRIVATE_KEY)
  });

  return TezToolkit;
};
