import React, { FC } from 'react';

import { Divider } from 'app/atoms';
import { Anchor } from 'app/atoms/Anchor';
import { LogoSecondary } from 'app/atoms/LogoSecondary';
import { ListItemWithNavigate } from 'app/molecules/ListItemWithNavigate';
import { T } from 'lib/i18n';

import { FooterSocials } from '../Socials/FooterSocials';
import { LINKS } from '../Socials/socials.consts';

const About: FC = () => (
  <div className="flex flex-col items-center pb-8">
    <div className="flex flex-col items-center mb-4">
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

    <div className="text-base-plus text-white">
      <T id="aboutDescription" />
    </div>

    <Divider color="bg-divider" className="mt-4" />

    <div className="w-full">
      {LINKS.map(({ link, testID, ...rest }) => (
        <Anchor key={link} href={link} testID={testID}>
          <ListItemWithNavigate {...rest} fullWidthDivider />
        </Anchor>
      ))}
    </div>
    <section className="flex flex-col items-center mt-8">
      <div className="mb-3 text-sm text-white text-center">
        <T id="aboutFooterDescription" />
      </div>
      <FooterSocials />
    </section>
  </div>
);

export default About;
