import { ReactComponent as Discordicon } from 'app/icons/discord.svg';
import { ReactComponent as DocumentIcon } from 'app/icons/document.svg';
import { ReactComponent as HelpIcon } from 'app/icons/help.svg';
import { ReactComponent as PlanetIcon } from 'app/icons/planet.svg';
import { ReactComponent as RepoIcon } from 'app/icons/repo.svg';
import { ReactComponent as ShieldIcon } from 'app/icons/shield-checkmark.svg';
import { ReactComponent as TelegramIcon } from 'app/icons/telegram.svg';
import { ReactComponent as TwitterIcon } from 'app/icons/twitter.svg';
import { ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';

import { AboutFooterLinkItemType, AboutLinkAdditionalprops } from './social.types';

export enum AboutSelectors {
  madFishLink = 'About/MadFish Link',
  websiteLink = 'About/Website Link',
  repoLink = 'About/Repo Link',
  twitterLink = 'About/Twitter Link',
  discordLink = 'About/Discord Link',
  telegramLink = 'About/Telegram Link',
  privacyPolicyLink = 'About/Privacy Policy Link',
  termsOfUseLink = 'About/Terms Of Use Link',
  contactLink = 'About/Contact Link'
}

export const LINKS: (ListItemWithNavigateprops & AboutLinkAdditionalprops)[] = [
  {
    key: 'website',
    link: 'https://mavryk.org',
    testID: AboutSelectors.websiteLink,
    i18nKey: 'ourWebsite',
    Icon: PlanetIcon,
    fillIcon: false
  },

  {
    key: 'privacyPolicy',
    link: 'https://docs.google.com/document/d/1Kl6Vo1WpEy8XjwzwbuGvyyDfDwwTc_x7q0WyfLfzJcs/edit?usp=sharing',
    testID: AboutSelectors.privacyPolicyLink,
    i18nKey: 'privacyPolicy',
    Icon: ShieldIcon,
    fillIcon: false
  },
  {
    key: 'termsOfUse',
    link: 'https://docs.google.com/document/d/1Qu9Ge-fBg9x3aCAjKgSYGHQgpeOKF5WWqOZVLP-cfyo/edit?usp=sharing',
    testID: AboutSelectors.termsOfUseLink,
    i18nKey: 'termsOfUse',
    Icon: DocumentIcon,
    fillIcon: false
  },
  {
    key: 'contact',
    link: 'https://t.me/+skFJjewPdRU5ZGQ0',
    testID: AboutSelectors.contactLink,
    i18nKey: 'contactUs',
    Icon: HelpIcon,
    fillIcon: false
  }
];

export const FOOTER_LINKS: AboutFooterLinkItemType[] = [
  {
    key: 'twitter',
    link: 'https://twitter.com/MavrykNetwork',
    testID: AboutSelectors.twitterLink,
    Icon: TwitterIcon
  },
  {
    key: 'discord',
    link: 'https://discord.gg/FXYQyVf6fE',
    testID: AboutSelectors.discordLink,
    Icon: Discordicon
  },
  {
    key: 'telegram',
    link: 'https://t.me/+skFJjewPdRU5ZGQ0',
    testID: AboutSelectors.telegramLink,
    Icon: TelegramIcon
  },
  {
    key: 'repo',
    link: 'https://github.com/mavryk-network',
    testID: AboutSelectors.repoLink,
    Icon: RepoIcon
  }
];
