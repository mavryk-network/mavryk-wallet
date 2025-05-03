import React, { FC } from 'react';

import { ButtonRounded, ButtonRoundedProps } from 'app/molecules/ButtonRounded';
import { T } from 'lib/i18n';

export const MaxButton: FC<Omit<ButtonRoundedProps, 'size'>> = props => {
  return (
    <ButtonRounded size="xs" {...props}>
      <T id="max" />
    </ButtonRounded>
  );
};
