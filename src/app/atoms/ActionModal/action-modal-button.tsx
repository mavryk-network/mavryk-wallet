import React, { memo } from 'react';

import clsx from 'clsx';

import { ButtonRounded, ButtonRoundedProps } from 'app/molecules/ButtonRounded';

export const ActionModalButton = memo<Omit<ButtonRoundedProps, 'size'>>(({ className, ...restProps }) => (
  <ButtonRounded size="big" className={clsx('flex-1', className)} {...restProps} />
));
