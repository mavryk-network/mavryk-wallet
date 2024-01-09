import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';

type SettingsPopupProps = {
  setOpened: (v: boolean) => void;
};

export const SettingsPopup: FC<SettingsPopupProps> = ({ setOpened }) => {
  return <div className="text-white px-4">Settings list popup</div>;
};
