import React, { FC, useState, useCallback, useRef, useEffect } from 'react';

import clsx from 'clsx';

import { setTestID, TestIDProperty } from 'lib/analytics';
import { TID, T } from 'lib/i18n';
import { selectNodeContent } from 'lib/ui/content-selection';

import { FieldLabel } from './FieldLabel';
import { FORM_FIELD_CLASS_NAME } from './FormField';
import { SecretCover } from './SecretCover';

interface ReadOnlySecretFieldProps extends TestIDProperty {
  label: TID;
  description?: React.ReactNode;
  value: string;
  secretCoverTestId?: string;
}

export const ReadOnlySecretField: FC<ReadOnlySecretFieldProps> = ({
  value,
  label,
  description,
  testID,
  secretCoverTestId
}) => {
  const [focused, setFocused] = useState(false);
  const fieldRef = useRef<HTMLParagraphElement>(null);

  const onSecretCoverClick = useCallback(() => void fieldRef.current?.focus(), []);

  const covered = !focused;

  useEffect(() => {
    if (!covered) selectNodeContent(fieldRef.current);
  }, [covered]);

  return (
    <div className="w-full flex flex-col">
      <FieldLabel label={<T id={label} />} description={description} className="mb-3" />

      <div className="relative flex items-stretch">
        <p
          ref={fieldRef}
          tabIndex={0}
          className={clsx(FORM_FIELD_CLASS_NAME, 'break-words py-3 px-4 overflow-y-auto')}
          style={{ height: 85 }}
          onFocus={() => void setFocused(true)}
          onBlur={() => void setFocused(false)}
          {...setTestID(testID)}
        >
          {covered ? '' : value}
        </p>

        {covered && <SecretCover onClick={onSecretCoverClick} testID={secretCoverTestId} />}
      </div>
    </div>
  );
};
