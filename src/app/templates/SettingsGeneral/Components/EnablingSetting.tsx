import React, { useCallback, useRef } from 'react';

import { FormCheckboxProps, FormCheckbox } from 'app/atoms';
import { Switcher } from 'app/atoms/Switcher';
import { T, TID, t } from 'lib/i18n';

interface Props extends Pick<FormCheckboxProps, 'onChange' | 'testID' | 'errorCaption'> {
  titleI18nKey: TID;
  descriptionI18nKey: TID;
  enabled?: boolean;
}

export const EnablingSetting = ({
  titleI18nKey,
  descriptionI18nKey,
  enabled,
  onChange,
  testID,
  errorCaption
}: Props) => {
  const handleChange = useCallback(
    (toChecked: boolean, event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(toChecked, event);
    },
    [onChange]
  );
  return (
    <div className="flex items-center gap-1">
      <div className="mb-4 leading-tight flex flex-col">
        <span className="text-base-plus font-semibold text-white">
          <T id={titleI18nKey} />
        </span>

        <span className="text-xs text-secondary-white">
          <T id={descriptionI18nKey} />
        </span>
      </div>

      <Switcher on={enabled} onChange={handleChange} />

      <FormCheckbox
        checked={enabled}
        onChange={onChange}
        label={t(enabled ? 'enabled' : 'disabled')}
        containerClassName="mb-4"
        testID={testID}
        errorCaption={errorCaption}
      />
    </div>
  );
};
