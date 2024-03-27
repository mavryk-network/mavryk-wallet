import React, { FC, useCallback } from 'react';

import { useIsLockUpEnabled } from 'lib/lock-up';

import { SettingsGeneralSelectors } from '../selectors';

import { EnablingSetting } from './EnablingSetting';

const LockUpSettings: FC<{}> = () => {
  const [isLockUpEnabled, saveIsLockUpEnabled] = useIsLockUpEnabled();

  const handleChange = useCallback(
    (v: boolean) => {
      saveIsLockUpEnabled(v);
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
