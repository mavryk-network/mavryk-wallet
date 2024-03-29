import React, { FC, useMemo, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { TID, t } from 'lib/i18n';

import { useTempleClient } from '../../../lib/temple/front';
import ImportTabSwitcher from '../../atoms/ImportTabSwitcher';

import { ImportFromKeystoreFile } from './import/ImportFromKeystoreFile/ImportFromKeystoreFile';
import { ImportFromSeedPhrase } from './import/ImportSeedPhrase/ImportFromSeedPhrase';
import { LockedWalletExists } from './LockedWalletExists';
import { SetWalletPassword } from './setWalletPassword/SetWalletPassword';

interface ImportWalletProps {
  tabSlug?: string;
  ownMnemonic: boolean;
}

const importWalletOptions: {
  slug: string;
  i18nKey: TID;
}[] = [
  {
    slug: 'seed-phrase',
    i18nKey: 'seedPhrase'
  },
  {
    slug: 'keystore-file',
    i18nKey: 'keystoreFile'
  }
];

export const ImportWallet: FC<ImportWalletProps> = ({ tabSlug = 'seed-phrase', ownMnemonic }) => {
  const { locked, ready } = useTempleClient();
  const { fullPage } = useAppEnv();

  const [seedPhrase, setSeedPhrase] = useState('');
  const [keystorePassword, setKeystorePassword] = useState('');
  const [isSeedEntered, setIsSeedEntered] = useState(false);
  const [isFromKeystoreFileWithUpdatedPassword, setIsFromKeystoreFileWithUpdatedPassword] = useState(false);

  const isImportFromSeedPhrase = tabSlug === 'seed-phrase';

  const memoizedContainerStyle = useMemo(
    () => ({
      paddingInline: fullPage ? 80 : 16,
      paddingTop: fullPage ? 16 : 0
    }),
    [fullPage]
  );

  return (
    <PageLayout
      pageTitle={!ready ? t('importWallet') : t('restoreAccount')}
      isTopbarVisible={false}
      removePaddings={true}
      contentContainerStyle={memoizedContainerStyle}
    >
      <ImportTabSwitcher tabs={importWalletOptions} activeTabSlug={tabSlug} urlPrefix="/import-wallet" />

      <LockedWalletExists locked={locked} />
      {isImportFromSeedPhrase ? (
        isSeedEntered ? (
          <div className={clsx(fullPage && 'mt-8 mb-11')}>
            <SetWalletPassword ownMnemonic={ownMnemonic} seedPhrase={seedPhrase} keystorePassword={keystorePassword} />
          </div>
        ) : (
          <ImportFromSeedPhrase
            seedPhrase={seedPhrase}
            setSeedPhrase={setSeedPhrase}
            setIsSeedEntered={setIsSeedEntered}
          />
        )
      ) : isSeedEntered && isFromKeystoreFileWithUpdatedPassword ? (
        <div className={clsx(fullPage && 'mt-8 mb-11')}>
          <SetWalletPassword ownMnemonic={ownMnemonic} seedPhrase={seedPhrase} keystorePassword={keystorePassword} />
        </div>
      ) : (
        <ImportFromKeystoreFile
          setSeedPhrase={setSeedPhrase}
          setKeystorePassword={setKeystorePassword}
          setIsSeedEntered={setIsSeedEntered}
          isSeedEntered={isSeedEntered}
          seedPhrase={seedPhrase}
          keystorePassword={keystorePassword}
          setIsFromKeystoreFileWithUpdatedPassword={setIsFromKeystoreFileWithUpdatedPassword}
          isFromKeystoreFileWithUpdatedPassword={isFromKeystoreFileWithUpdatedPassword}
        />
      )}
    </PageLayout>
  );
};
