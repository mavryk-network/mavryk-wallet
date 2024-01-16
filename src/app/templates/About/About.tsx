import React, { FC } from 'react';

import { Divider } from 'app/atoms';
import { Anchor } from 'app/atoms/Anchor';
import { LogoSecondary } from 'app/atoms/LogoSecondary';
import { ReactComponent as Discordicon } from 'app/icons/discord.svg';
import { ReactComponent as DocumentIcon } from 'app/icons/document.svg';
import { ReactComponent as HelpIcon } from 'app/icons/help.svg';
import { ReactComponent as PlanetIcon } from 'app/icons/planet.svg';
import { ReactComponent as RepoIcon } from 'app/icons/repo.svg';
import { ReactComponent as ShieldIcon } from 'app/icons/shield-checkmark.svg';
import { ReactComponent as TelegramIcon } from 'app/icons/telegram.svg';
import { ReactComponent as TwitterIcon } from 'app/icons/twitter.svg';
import { ListItemWithNavigateprops, ListItemWithNavigate } from 'app/molecules/ListItemWithNavigate';
import { T } from 'lib/i18n';

import { AboutSelectors } from './About.selectors';

type AboutLinkAdditionalprops = { key: string; testID: string; link: string };
type AboutFooterLinkItemType = AboutLinkAdditionalprops & { Icon: ImportedSVGComponent };

const LINKS: (ListItemWithNavigateprops & AboutLinkAdditionalprops)[] = [
  {
    key: 'website',
    link: 'https://templewallet.com',
    testID: AboutSelectors.websiteLink,
    i18nKey: 'ourWebsite',
    Icon: PlanetIcon
  },

  {
    key: 'privacyPolicy',
    link: 'https://templewallet.com/privacy',
    testID: AboutSelectors.privacyPolicyLink,
    i18nKey: 'privacyPolicy',
    Icon: ShieldIcon
  },
  {
    key: 'termsOfUse',
    link: 'https://templewallet.com/terms',
    testID: AboutSelectors.termsOfUseLink,
    i18nKey: 'termsOfUse',
    Icon: DocumentIcon
  },
  {
    key: 'contact',
    link: 'https://templewallet.com/contact',
    testID: AboutSelectors.contactLink,
    i18nKey: 'contactUs',
    Icon: HelpIcon
  }
];

const FOOTER_LINKS: AboutFooterLinkItemType[] = [
  {
    key: 'twitter',
    link: 'https://templewallet.com',
    testID: AboutSelectors.twitterLink,
    Icon: TwitterIcon
  },
  {
    key: 'discord',
    link: 'https://templewallet.com',
    testID: AboutSelectors.discordLink,
    Icon: Discordicon
  },
  {
    key: 'telegram',
    link: 'https://templewallet.com',
    testID: AboutSelectors.telegramLink,
    Icon: TelegramIcon
  },
  {
    key: 'repo',
    link: 'https://templewallet.com',
    testID: AboutSelectors.repoLink,
    Icon: RepoIcon
  }
];

const About: FC = () => (
  <div className="flex flex-col items-center pb-8">
    <div className="flex flex-col items-center mb-4">
      <LogoSecondary style={{ width: 44, height: 44 }} className="mb-3" />

      <div className="text-center">
        <h4 className="text-base-plus text-white">
          <T id="appName" />
        </h4>

        <p className="text-sm text-secondary-white">
          <T
            id="versionLabel"
            substitutions={[
              <span className="font-bold" key="version">
                {process.env.VERSION}
              </span>
            ]}
          />
        </p>
      </div>
    </div>

    <div className="text-base-plus text-white">
      <T id="aboutDescription" />
    </div>

    <Divider color="bg-divider" className="mt-4" />

    <div className="w-full">
      {LINKS.map(({ link, testID, ...rest }) => (
        <Anchor key={link} href={link} testID={testID}>
          <ListItemWithNavigate {...rest} />
        </Anchor>
      ))}
    </div>
    <section className="flex flex-col items-center mt-8">
      <div className="mb-3 text-sm text-white text-center">
        <T id="aboutFooterDescription" />
      </div>
      <div className="flex items-center gap-2">
        {FOOTER_LINKS.map(link => (
          <FooterLinkItem {...link} />
        ))}
      </div>
    </section>
  </div>
);

export default About;

const FooterLinkItem: FC<AboutFooterLinkItemType> = ({ Icon, link, testID }) => {
  return (
    <Anchor testID={testID} href={link} className="border border-divider p-1 no-underline">
      <Icon className="w-6 h-6" />
    </Anchor>
  );
};
