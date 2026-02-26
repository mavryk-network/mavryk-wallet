import React, { FC } from 'react';

import { StakeAmountForm } from '../components/StakeAmountForm';

export const DecreaseStake: FC = () => {
  return <StakeAmountForm mode="decrease" />;
};
