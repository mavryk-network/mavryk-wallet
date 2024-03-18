import React, { FC, useState, useCallback, useRef, useEffect } from 'react';

import clsx from 'clsx';

import { ReactComponent as CopyIcon } from 'app/icons/copy.svg';
import { setTestID, TestIDProperty } from 'lib/analytics';
import { TID, T } from 'lib/i18n';
import { selectNodeContent } from 'lib/ui/content-selection';

import CopyButton from './CopyButton';
import { FieldLabel } from './FieldLabel';
import { FORM_FIELD_CLASS_NAME_SECONDARY } from './FormField';
import { SecretCover } from './SecretCover';
interface ReadOnlySecretFieldProps extends TestIDProperty {
  label: TID;
  description?: React.ReactNode;
  value: string;
  showCopyIcon?: boolean;
  secretCoverTestId?: string;
}

export const ReadOnlySecretField: FC<ReadOnlySecretFieldProps> = ({
  value,
  label,
  description,
  showCopyIcon = false,
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
          className={clsx(
            FORM_FIELD_CLASS_NAME_SECONDARY,
            'break-words py-3 overflow-y-auto',
            showCopyIcon ? 'pl-4 pr-8' : 'px-4'
          )}
          style={{ height: 85 }}
          onFocus={() => void setFocused(true)}
          onBlur={() => void setFocused(false)}
          {...setTestID(testID)}
        >
          {covered ? '' : value}
          {!covered && showCopyIcon && (
            <CopyButton text={value} type="button" className={'flex items-center text-blue-200 absolute top-2 right-2'}>
              <CopyIcon className="text-blue-200 fill-current w-6 h-6" />
            </CopyButton>
          )}
        </p>

        {covered && <SecretCover onClick={onSecretCoverClick} testID={secretCoverTestId} />}
      </div>
    </div>
  );
};
