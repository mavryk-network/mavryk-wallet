import React, { FC } from 'react';

import { T, TID } from 'lib/i18n';
import { Link } from 'lib/woozie';

import { ButtonRounded, ButtonRoundedProps } from './ButtonRounded';

type ButtonNavigateprops = ButtonRoundedProps & {
  i18nKey?: TID;
  link?: string;
};

export const ButtonNavigate: FC<ButtonNavigateprops> = ({ i18nKey = 'goToMain', link = '/', ...rest }) => {
  return (
    <Link to={link}>
      <ButtonRounded size="big" fill className="w-full justify-center mt-8" {...rest}>
        <T id={i18nKey} />
      </ButtonRounded>
    </Link>
  );
};
