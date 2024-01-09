import React, { FC } from 'react';

import { ReactComponent as BurgerIcon } from 'app/icons/burger.svg';

type SettingButtonProps = {
  onClick: () => void;
};

export const SettingButton: FC<SettingButtonProps> = ({ onClick }) => {
  return <BurgerIcon onClick={onClick} className="w-6 h-6 fill-white cursor-pointer" />;
};
