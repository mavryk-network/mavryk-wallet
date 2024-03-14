import React, { FC, useMemo, useState } from 'react';

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

export const ImportWallet: FC<ImportWalletProps> = ({ tabSlug = 'seed-phrase' }) => {
  const { locked } = useTempleClient();
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
      pageTitle={fullPage ? t('importWallet') : t('restoreAccount')}
      isTopbarVisible={false}
      removePaddings
      contentContainerStyle={memoizedContainerStyle}
    >
      <ImportTabSwitcher tabs={importWalletOptions} activeTabSlug={tabSlug} urlPrefix="/import-wallet" />

      <LockedWalletExists locked={locked} />
      {isImportFromSeedPhrase ? (
        isSeedEntered ? (
          <SetWalletPassword ownMnemonic seedPhrase={seedPhrase} keystorePassword={keystorePassword} />
        ) : (
          <ImportFromSeedPhrase
            seedPhrase={seedPhrase}
            setSeedPhrase={setSeedPhrase}
            setIsSeedEntered={setIsSeedEntered}
          />
        )
      ) : isSeedEntered && isFromKeystoreFileWithUpdatedPassword ? (
        <SetWalletPassword ownMnemonic seedPhrase={seedPhrase} keystorePassword={keystorePassword} />
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
