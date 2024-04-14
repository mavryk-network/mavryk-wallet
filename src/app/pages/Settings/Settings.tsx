import React, { FC, useMemo, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as AddressBookIcon } from 'app/icons/addressBook.svg';
import { ReactComponent as AppsIcon } from 'app/icons/apps.svg';
import { ReactComponent as ConnectLedgericon } from 'app/icons/connect-clip.svg';
// import { ReactComponent as HelpIcon } from 'app/icons/help.svg';
import { ReactComponent as KeyIcon } from 'app/icons/key.svg';
import { ReactComponent as RoundedInfoIcon } from 'app/icons/rounded-info.svg';
import { ReactComponent as RoundedMinusIcon } from 'app/icons/rounded-minus.svg';
import { ReactComponent as RoundedPlusIcon } from 'app/icons/rounded-plus.svg';
import { ReactComponent as SettingsIcon } from 'app/icons/settings.svg';
import { ReactComponent as StickerIcon } from 'app/icons/sticker.svg';
import { ReactComponent as SyncIcon } from 'app/icons/sync.svg';
import PageLayout from 'app/layouts/PageLayout';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';
import About from 'app/templates/About/About';
import ActivateAccount from 'app/templates/ActivateAccount/ActivateAccount';
import { AddContact } from 'app/templates/AddressBook/AddContact';
import { AddressBook } from 'app/templates/AddressBook/AddressBook';
import DAppSettings from 'app/templates/DAppSettings/DAppSettings';
// import HelpAndCommunity from 'app/templates/HelpAndCommunity';
import RemoveAccount from 'app/templates/RemoveAccount/RemoveAccount';
import RevealSecret from 'app/templates/RevealSecrets/RevealSecret';
import GeneralSettings from 'app/templates/SettingsGeneral';
import SyncSettings from 'app/templates/Synchronization/SyncSettings';
import { T } from 'lib/i18n';

import ConnectLedger from '../ConnectLedger/ConnectLedger';

// import ImportAccount from '../ImportAccount';
import { SettingsSelectors } from './Settings.selectors';

type SettingsProps = {
  tabSlug?: string | null;
};

export type TabComponentProps = {
  setToolbarRightSidedComponent: React.Dispatch<React.SetStateAction<JSX.Element | null>>;
  toolbarRightSidedComponent: JSX.Element | null;
};

const RevealPrivateKey: FC = () => <RevealSecret reveal="private-key" />;
const RevealSeedPhrase: FC = () => <RevealSecret reveal="seed-phrase" />;

type Tab = ListItemWithNavigateprops & {
  Component: React.FC<TabComponentProps>;
  testID?: SettingsSelectors;
  hidden?: boolean;
};

const TABS: Tab[] = [
  {
    linkTo: 'general-settings',
    Icon: SettingsIcon,
    i18nKey: 'general',
    Component: GeneralSettings,
    testID: SettingsSelectors.generalButton,
    fillIcon: false
  },
  {
    linkTo: 'address-book',
    i18nKey: 'addressBook',
    Icon: AddressBookIcon,
    Component: AddressBook,
    testID: SettingsSelectors.addressBookButton,
    fillIcon: false
  },
  {
    linkTo: 'add-contact',
    i18nKey: 'addContact',
    Icon: null,
    Component: AddContact,
    hidden: true,
    testID: SettingsSelectors.addContactButton
  },
  {
    linkTo: 'dapps',
    i18nKey: 'authorizedDApps',
    Icon: AppsIcon,
    Component: DAppSettings,
    testID: SettingsSelectors.dAppsButton,
    fillIcon: false
  },
  {
    linkTo: 'synchronization',
    i18nKey: 'synchronization',
    Icon: SyncIcon,
    Component: SyncSettings,
    testID: SettingsSelectors.synchronizationButton,
    fillIcon: false
  },
  {
    linkTo: 'connect-ledger',
    i18nKey: 'connectWithLedger',
    Icon: ConnectLedgericon,
    Component: ConnectLedger,
    testID: SettingsSelectors.connectLedger,
    fillIcon: false
  },
  {
    linkTo: 'reveal-private-ke',
    i18nKey: 'revealPrivateKey',
    Icon: KeyIcon,
    Component: RevealPrivateKey,
    testID: SettingsSelectors.revealPrivateKeyButton,
    fillIcon: false
  },
  {
    linkTo: 'reveal-seed-phrase',
    i18nKey: 'revealSeedPhrase',
    Icon: StickerIcon,
    Component: RevealSeedPhrase,
    testID: SettingsSelectors.revealSeedPhraseButton,
    fillIcon: false
  },
  {
    linkTo: 'activate-account',
    i18nKey: 'activateAccount',
    Icon: RoundedPlusIcon,
    Component: ActivateAccount,
    testID: SettingsSelectors.activateAccountButton,
    fillIcon: false
  },
  {
    linkTo: 'remove-account',
    i18nKey: 'removeAccount',
    Icon: RoundedMinusIcon,
    Component: RemoveAccount,
    testID: SettingsSelectors.removeAccountButton,
    fillIcon: false
  },
  {
    linkTo: 'about',
    i18nKey: 'about',
    Icon: RoundedInfoIcon,
    Component: About,
    testID: SettingsSelectors.aboutButton,
    fillIcon: false
  }
  // {
  //   linkTo: 'help-and-community',
  //   i18nKey: 'helpAndCommunity',
  //   Icon: HelpIcon,
  //   Component: ImportAccount,
  //   fillIcon: false
  // }
];

const Settings: FC<SettingsProps> = ({ tabSlug }) => {
  const { popup } = useAppEnv();
  const activeTab = useMemo(() => TABS.find(t => t.linkTo === tabSlug) || null, [tabSlug]);
  const [toolbarRightSidedComponent, setToolbarRightSidedComponent] = useState<JSX.Element | null>(null);

  let tId = activeTab?.i18nKey ?? 'settings';
  tId = activeTab?.i18nKey === 'connectWithLedger' ? 'connectLedger' : tId;

  return (
    <PageLayout
      pageTitle={
        <>
          <T id={tId} />
        </>
      }
      isTopbarVisible={false}
      removePaddings={!activeTab || activeTab.linkTo === 'about'}
      RightSidedComponent={toolbarRightSidedComponent}
    >
      <div className="h-full">
        <div className="h-full">
          {activeTab ? (
            <activeTab.Component
              setToolbarRightSidedComponent={setToolbarRightSidedComponent}
              toolbarRightSidedComponent={toolbarRightSidedComponent}
            />
          ) : (
            <ul className={clsx('flex flex-col pb-8', !popup && 'px-12')}>
              {TABS.filter(tab => !tab.hidden).map(({ linkTo, ...tab }) => (
                <ListItemWithNavigate key={linkTo} {...tab} linkTo={'/settings/'.concat(linkTo ?? '')} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Settings;
