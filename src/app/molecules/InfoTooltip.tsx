import React, { FC } from 'react';

import { ReactComponent as InfoIcon } from 'app/icons/rounded-info.svg';
import { Tooltip, TooltipProps } from 'lib/ui/Tooltip';

export const InfoTooltip: FC<Omit<TooltipProps, 'children'>> = ({ ...rest }) => {
  return (
    <Tooltip {...rest}>
      <div className="inline-block">
        <InfoIcon className="w-6 h-6 size-6 stroke-1 stroke-white" />
      </div>
    </Tooltip>
  );
};
