import React, { FC, useCallback } from 'react';

import browser from 'webextension-polyfill';

import { LOCK_UP_ENABLED_STORAGE_KEY } from 'lib/constants';
import { useIsLockUpEnabled } from 'lib/lock-up';

import { SettingsGeneralSelectors } from '../selectors';

import { EnablingSetting } from './EnablingSetting';

const LockUpSettings: FC<{}> = () => {
  const [isLockUpEnabled, saveIsLockUpEnabled] = useIsLockUpEnabled();

  const handleChange = useCallback(
    (v: boolean) => {
      saveIsLockUpEnabled(v);
      browser.storage.local.set({ [LOCK_UP_ENABLED_STORAGE_KEY]: v }).catch(err => console.error(err));
    },
    [saveIsLockUpEnabled]
  );

  return (
    <EnablingSetting
      titleI18nKey="lockUpSettings"
      descriptionI18nKey="lockUpSettingsDescription"
      enabled={isLockUpEnabled}
      onChange={handleChange}
      testID={SettingsGeneralSelectors.extensionLockUpCheckBox}
    />
  );
};

export default LockUpSettings;
