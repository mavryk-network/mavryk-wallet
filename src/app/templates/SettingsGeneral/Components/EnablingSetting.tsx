import React, { useCallback } from 'react';

import clsx from 'clsx';

import { FormCheckboxProps } from 'app/atoms';
import { Switcher } from 'app/atoms/Switcher';
import { useAppEnv } from 'app/env';
import { T, TID } from 'lib/i18n';

interface Props extends Pick<FormCheckboxProps, 'onChange' | 'testID' | 'errorCaption'> {
  titleI18nKey: TID;
  descriptionI18nKey: TID;
  enabled?: boolean;
  disabled?: boolean;
}

export const EnablingSetting = ({
  titleI18nKey,
  descriptionI18nKey,
  enabled,
  onChange,
  disabled,
  // testID,
  errorCaption
}: Props) => {
  const { popup } = useAppEnv();
  const handleChange = useCallback(
    (toChecked: boolean, event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(toChecked, event);
    },
    [onChange]
  );
  return (
    <div className={clsx('flex items-start w-full justify-between gap-1', popup ? 'gap-1' : 'gap-4')}>
      <div className="mb-4 leading-tight flex flex-col" style={{ maxWidth: popup ? 283 : '100%' }}>
        <span className="text-base-plus text-white">
          <T id={titleI18nKey} />
        </span>

        <span className="text-xs text-secondary-white">
          <T id={descriptionI18nKey} />
        </span>
        {errorCaption && <div className="text-sm text-primary-error">{errorCaption}</div>}
      </div>
      <div className="w-auto">
        <Switcher on={enabled} onChange={handleChange} disabled={disabled} />
      </div>
    </div>
  );
};
