import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import PageLayout from 'app/layouts/PageLayout';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { TID, T } from 'lib/i18n';
import { useSetAccountPkh, useAllAccounts, useNetwork } from 'lib/temple/front';
import { isTruthy } from 'lib/utils';
import { HistoryAction, navigate } from 'lib/woozie';

import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import { ByFundraiserForm } from './ByFundraiserForm';
import { ByMnemonicForm } from './ByMnemonicForm';
import { ByPrivateKeyForm } from './ByPrivateKeyForm';
// import { FromFaucetForm } from './FromFaucetForm';
import { ManagedKTForm } from './ManagedKTForm';
import { ImportformProps } from './types';
import { WatchOnlyForm } from './WatchOnlyForm';

type ImportAccountProps = {
  tabSlug: string | null;
};

interface ImportTabDescriptor {
  slug: string;
  i18nKey: TID;
  Form: FC<ImportformProps>;
}

const ImportAccount: FC<ImportAccountProps> = ({ tabSlug }) => {
  const network = useNetwork();
  const allAccounts = useAllAccounts();
  const setAccountPkh = useSetAccountPkh();

  const prevAccLengthRef = useRef(allAccounts.length);
  const prevNetworkRef = useRef(network);

  useEffect(() => {
    const accLength = allAccounts.length;
    if (prevAccLengthRef.current < accLength) {
      setAccountPkh(allAccounts[accLength - 1].publicKeyHash);

      navigate<SuccessStateType>('/success', undefined, {
        pageTitle: 'importAccount',
        btnText: 'goToMain',
        description: 'impoprtAccSuccessMessage',
        subHeader: 'success'
      });
    }
    prevAccLengthRef.current = accLength;
  }, [allAccounts, setAccountPkh]);

  // private key, seed phrase, Fundaiser, Managed KT, Watch-only
  const importOptions = useMemo(() => {
    const unfiltered: (ImportTabDescriptor | null)[] = [
      {
        slug: 'private-key',
        i18nKey: 'privateKey',
        Form: ByPrivateKeyForm
      },
      {
        slug: 'mnemonic',
        i18nKey: 'seedPhrase',
        Form: ByMnemonicForm
      },
      {
        slug: 'fundraiser',
        i18nKey: 'fundraiser',
        Form: ByFundraiserForm
      },
      // network.type !== 'main'
      //   ? {
      //       slug: 'faucet',
      //       i18nKey: 'faucetFileTitle',
      //       Form: FromFaucetForm
      //     }
      //   : null,
      {
        slug: 'managed-kt',
        i18nKey: 'managedKTAccount',
        Form: ManagedKTForm
      },
      {
        slug: 'watch-only',
        i18nKey: 'watchOnlyAccount',
        Form: WatchOnlyForm
      }
    ];

    return unfiltered.filter(isTruthy);
  }, [network.type]);

  const { slug, Form } = useMemo(() => {
    const tab = tabSlug ? importOptions.find(currentTab => currentTab.slug === tabSlug) : null;
    return tab ?? importOptions[0];
  }, [importOptions, tabSlug]);

  useEffect(() => {
    const prevNetworkType = prevNetworkRef.current.type;
    prevNetworkRef.current = network;
    if (prevNetworkType !== 'main' && network.type === 'main' && slug === 'faucet') {
      navigate(`/import-account/private-key`);
    }
  }, [network, slug]);

  const handlePresetSelected = useCallback((slug: string) => {
    navigate(`/import-account/${slug}`, HistoryAction.Replace);
  }, []);

  const selectedImportOtion = useMemo(
    () => importOptions.find(option => option.slug === slug) ?? importOptions[0],
    [importOptions, slug]
  );

  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={
        <>
          <span className="capitalize">
            <T id="importAccount" />
          </span>
        </>
      }
    >
      <section className="h-full flex flex-col">
        <div className="pb-4 border-b border-divider mb-4">
          <label className="flex flex-col mb-4 leading-tight">
            <span className="text-base-plus text-white">
              <T id="chooseImportMethod" />
            </span>
          </label>
          <div className="relative flex flex-col items-stretch rounded">
            <DropdownSelect
              optionsListClassName="p-0"
              dropdownWrapperClassName="border-none rounded-2xl-plus"
              dropdownButtonClassName="px-4 py-14px"
              DropdownFaceContent={<ImportOptionFace {...selectedImportOtion} />}
              optionsProps={{
                options: importOptions,
                noItemsText: 'No items',
                getKey: getImportOption,
                renderOptionContent: option => <ImportAccountOptionContent {...option} />,
                onOptionChange: option => handlePresetSelected(option.slug)
              }}
            />
          </div>
        </div>

        <Form className="h-full flex-grow flex flex-col justify-between" />
      </section>
    </PageLayout>
  );
};

// Dropdown additional components ---------------
const getImportOption = (option: ImportTabDescriptor) => option.slug;

const ImportOptionFace: FC<ImportTabDescriptor> = ({ i18nKey }) => {
  return (
    <section className="flex items-center justify-between w-full text-base-plus text-white">
      <span className="capitalize">
        <T id={i18nKey} />
      </span>
    </section>
  );
};

const ImportAccountOptionContent: FC<ImportTabDescriptor> = ({ i18nKey }) => {
  return (
    <>
      <div className="p-4 flex items-center justify-between w-full bg-primary-card hover:bg-gray-710">
        <div className="text-base-plus text-white text-left">
          <T id={i18nKey} />
        </div>
      </div>
    </>
  );
};

export default ImportAccount;
