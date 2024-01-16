import React, { FC, SVGProps } from 'react';

import { ReactComponent as LogoIcon } from 'app/icons/logo-secondary.svg';

export const LogoSecondary: FC<SVGProps<SVGSVGElement>> = ({ ...rest }) => {
  return <LogoIcon {...rest} />;
};
