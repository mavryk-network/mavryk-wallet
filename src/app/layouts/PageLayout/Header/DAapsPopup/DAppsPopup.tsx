import React, { FC } from 'react';

type DAppsPopupProps = {
  opened: boolean;
  setOpened: (v: boolean) => void;
};

// export const DAppsPopup: FC<DAppsPopupProps> = ({ opened, setOpened }) => {
export const DAppsPopup: FC<DAppsPopupProps> = () => {
  return <section className="my-2">DAppsPopup</section>;
};
