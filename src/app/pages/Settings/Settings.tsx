import React, { FC, useMemo } from 'react';

import classNames from 'clsx';

import { ReactComponent as AddressBookIcon } from 'app/icons/addressBook.svg';
import { ReactComponent as AppsIcon } from 'app/icons/apps.svg';
import { ReactComponent as ConnectLedgericon } from 'app/icons/connect-clip.svg';
import { ReactComponent as HelpIcon } from 'app/icons/help.svg';
import { ReactComponent as KeyIcon } from 'app/icons/key.svg';
import { ReactComponent as RoundedInfoIcon } from 'app/icons/rounded-info.svg';
import { ReactComponent as RoundedMinusIcon } from 'app/icons/rounded-minus.svg';
import { ReactComponent as RoundedPlusIcon } from 'app/icons/rounded-plus.svg';
import { ReactComponent as SettingsIcon } from 'app/icons/settings.svg';
import { ReactComponent as StickerIcon } from 'app/icons/sticker.svg';
import { ReactComponent as SyncIcon } from 'app/icons/sync.svg';
import PageLayout from 'app/layouts/PageLayout';
import { ListItemWithnavigate, ListItemWithnavigateprops } from 'app/molecules/ListItemWithNavigate';
import About from 'app/templates/About/About';
import ActivateAccount from 'app/templates/ActivateAccount/ActivateAccount';
import AddressBook from 'app/templates/AddressBook/AddressBook';
import DAppSettings from 'app/templates/DAppSettings/DAppSettings';
import HelpAndCommunity from 'app/templates/HelpAndCommunity';
import RemoveAccount from 'app/templates/RemoveAccount/RemoveAccount';
import RevealSecret from 'app/templates/RevealSecrets/RevealSecret';
import GeneralSettings from 'app/templates/SettingsGeneral';
import SyncSettings from 'app/templates/Synchronization/SyncSettings';
import { T } from 'lib/i18n';

import ConnectLedger from '../ConnectLedger/ConnectLedger';
import { SettingsSelectors } from './Settings.selectors';

type SettingsProps = {
  tabSlug?: string | null;
};

const RevealPrivateKey: FC = () => <RevealSecret reveal="private-key" />;
const RevealSeedPhrase: FC = () => <RevealSecret reveal="seed-phrase" />;

type Tab = ListItemWithnavigateprops & {
  Component: React.FC;
  testID?: SettingsSelectors;
};

const TABS: Tab[] = [
  {
    linkTo: 'general-settings',
    Icon: SettingsIcon,
    i18nKey: 'general',
    Component: GeneralSettings,
    onClick: () => {},
    testID: SettingsSelectors.generalButton,
    fillIcon: false
  },
  {
    linkTo: 'address-book',
    i18nKey: 'addressBook',
    Icon: AddressBookIcon,
    Component: AddressBook,
    onClick: () => {},
    testID: SettingsSelectors.addressBookButton,
    fillIcon: false
  },
  {
    linkTo: 'dapps',
    i18nKey: 'authorizedDApps',
    Icon: AppsIcon,
    Component: DAppSettings,
    onClick: () => {},
    testID: SettingsSelectors.dAppsButton,
    fillIcon: false
  },
  {
    linkTo: 'synchronization',
    i18nKey: 'synchronization',
    Icon: SyncIcon,
    Component: SyncSettings,
    onClick: () => {},
    testID: SettingsSelectors.synchronizationButton,
    fillIcon: false
  },
  {
    linkTo: 'connect-ledger',
    i18nKey: 'connectLedger',
    Icon: ConnectLedgericon,
    Component: ConnectLedger,
    onClick: () => {},
    testID: SettingsSelectors.connectLedger,
    fillIcon: false
  },
  {
    linkTo: 'reveal-private-ke',
    i18nKey: 'revealPrivateKey',
    Icon: KeyIcon,
    Component: RevealPrivateKey,
    onClick: () => {},
    testID: SettingsSelectors.revealPrivateKeyButton,
    fillIcon: false
  },
  {
    linkTo: 'reveal-seed-phrase',
    i18nKey: 'revealSeedPhrase',
    Icon: StickerIcon,
    Component: RevealSeedPhrase,
    onClick: () => {},
    testID: SettingsSelectors.revealSeedPhraseButton,
    fillIcon: false
  },
  {
    linkTo: 'activate-account',
    i18nKey: 'activateAccount',
    Icon: RoundedPlusIcon,
    Component: ActivateAccount,
    onClick: () => {},
    testID: SettingsSelectors.activateAccountButton,
    fillIcon: false
  },
  {
    linkTo: 'remove-account',
    i18nKey: 'removeAccount',
    Icon: RoundedMinusIcon,
    Component: RemoveAccount,
    onClick: () => {},
    testID: SettingsSelectors.removeAccountButton,
    fillIcon: false
  },
  {
    linkTo: 'about',
    i18nKey: 'about',
    Icon: RoundedInfoIcon,
    Component: About,
    onClick: () => {},
    testID: SettingsSelectors.aboutButton,
    fillIcon: false
  },
  {
    linkTo: 'help-and-community',
    i18nKey: 'helpAndCommunity',
    Icon: HelpIcon,
    Component: HelpAndCommunity,
    onClick: () => {},
    fillIcon: false
  }
];

const Settings: FC<SettingsProps> = ({ tabSlug }) => {
  const activeTab = useMemo(() => TABS.find(t => t.linkTo === tabSlug) || null, [tabSlug]);

  const tId = activeTab?.i18nKey ?? 'settings';

  return (
    <PageLayout
      pageTitle={
        <>
          <T id={tId} />
        </>
      }
      isTopbarVisible={false}
      removePaddings={!activeTab}
    >
      <div className="mb-8">
        {activeTab && (
          <>
            {/* <h1
              className={classNames(
                'mb-2',
                'flex items-center justify-center',
                'text-2xl font-light text-white text-center'
              )}
            >
              {(() => {
                const { Icon, i18nKey } = activeTab;
                return (
                  <T id={i18nKey}>
                    {message => (
                      <>
                        <Icon className="mr-2 h-8 w-8 fill-white" />
                        {message}
                      </>
                    )}
                  </T>
                );
              })()}
            </h1> */}

            {/* <hr className="mb-8" /> */}
          </>
        )}

        <div>
          {activeTab ? (
            <activeTab.Component />
          ) : (
            <ul className="flex flex-col">
              {TABS.map(({ linkTo, ...tab }) => (
                <ListItemWithnavigate {...tab} linkTo={'/settings/'.concat(linkTo ?? '')} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Settings;
