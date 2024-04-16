import React, { FC } from 'react';

import clsx from 'clsx';

import { Divider } from 'app/atoms';
import { Anchor } from 'app/atoms/Anchor';
import { LogoSecondary } from 'app/atoms/LogoSecondary';
import { useAppEnv } from 'app/env';
import { ListItemWithNavigate } from 'app/molecules/ListItemWithNavigate';
import { T } from 'lib/i18n';

import { FooterSocials } from '../Socials/FooterSocials';
import { LINKS } from '../Socials/socials.consts';

const About: FC = () => {
  const { popup } = useAppEnv();

  return (
    <div className={clsx('flex flex-col items-center', popup ? 'pb-8 pt-4' : 'px-20 pt-8 pb-11')}>
      <div className="relative flex flex-col items-center mb-4 px-4">
        <LogoSecondary style={{ width: 44, height: 44 }} className="mb-3" />

        <div className="text-center">
          <h4 className="text-base-plus text-white">
            <T id="appName" />
          </h4>

          <p className="text-sm text-secondary-white">
            <T id="versionLabel" substitutions={[<span key="version">{process.env.VERSION}</span>]} />
          </p>
        </div>
      </div>

      <div className={clsx('text-base-plus text-white', popup && 'px-4')}>
        <T id="aboutDescription" />
      </div>

      <Divider
        ignoreParent={!popup}
        color="bg-divider"
        className={clsx('mt-4', popup ? 'px-4' : 'px-20 max-w-screen-xxs')}
      />

      <div className="w-full">
        {LINKS.map(({ link, testID, ...rest }) => (
          <Anchor key={link} href={link} testID={testID}>
            <ListItemWithNavigate {...rest} />
          </Anchor>
        ))}
      </div>
      <section className="flex flex-col items-center mt-8 px-4">
        <div className="mb-3 text-sm text-white text-center">
          <T id="aboutFooterDescription" />
        </div>
        <FooterSocials />
      </section>
    </div>
  );
};

export default About;
