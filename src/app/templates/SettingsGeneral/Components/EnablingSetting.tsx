import React, { useCallback } from 'react';

import { FormCheckboxProps } from 'app/atoms';
import { Switcher } from 'app/atoms/Switcher';
import { T, TID } from 'lib/i18n';

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
  // testID,
  errorCaption
}: Props) => {
  const handleChange = useCallback(
    (toChecked: boolean, event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(toChecked, event);
    },
    [onChange]
  );
  return (
    <div className="flex items-start w-full justify-between gap-1">
      <div className="mb-4 leading-tight flex flex-col" style={{ maxWidth: 283 }}>
        <span className="text-base-plus text-white">
          <T id={titleI18nKey} />
        </span>

        <span className="text-xs text-secondary-white">
          <T id={descriptionI18nKey} />
        </span>
        {errorCaption && <div className="text-sm text-primary-error">{errorCaption}</div>}
      </div>
      <div className="w-auto">
        <Switcher on={enabled} onChange={handleChange} />
      </div>
    </div>
  );
};
