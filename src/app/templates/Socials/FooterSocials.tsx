import React, { FC } from 'react';

import classNames from 'clsx';

import { Anchor } from 'app/atoms';

import { AboutFooterLinkItemType } from './social.types';
import { FOOTER_LINKS } from './socials.consts';

export type FooterSocialsProps = {
  className?: string;
};

export const FooterSocials: FC<FooterSocialsProps> = ({ className }) => {
  return (
    <div className={classNames('flex items-center gap-2', className)}>
      {FOOTER_LINKS.map(link => (
        <FooterLinkItem {...link} />
      ))}
    </div>
  );
};

const FooterLinkItem: FC<AboutFooterLinkItemType> = ({ Icon, link, testID }) => {
  return (
    <Anchor testID={testID} href={link} className="border border-divider p-1 no-underline rounded">
      <Icon className="w-6 h-6" />
    </Anchor>
  );
};
