import React, { forwardRef, ReactNode, useCallback } from 'react';

import classNames from 'clsx';

import Checkbox, { CheckboxProps } from 'app/atoms/Checkbox';
import { AnalyticsEventCategory, setTestID, useAnalytics } from 'lib/analytics';
import { merge } from 'lib/utils/merge';

export interface FormCheckboxProps extends CheckboxProps {
  label?: ReactNode;
  labelDescription?: ReactNode;
  errorCaption?: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
}

export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  (
    {
      label,
      labelDescription,
      errorCaption,
      containerClassName,
      labelClassName,
      onChange,
      testID,
      testIDProperties,
      ...rest
    },
    ref
  ) => {
    const { trackEvent } = useAnalytics();

    const handleChange = useCallback(
      (toChecked: boolean, event: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(toChecked, event);

        testID && trackEvent(testID, AnalyticsEventCategory.CheckboxChange, { toChecked, ...testIDProperties });
      },
      [onChange, trackEvent, testID, testIDProperties]
    );

    return (
      <div className={classNames('flex flex-col', containerClassName)}>
        <label
          className={merge(
            'flex items-center py-2',
            'rounded overflow-hidden cursor-pointer bg-primary-bg',
            labelClassName
          )}
          {...setTestID(testID)}
        >
          <Checkbox ref={ref} errored={Boolean(errorCaption)} onChange={handleChange} {...rest} />

          {label && (
            <div className="ml-2 flex flex-col">
              <span className="text-sm text-white">{label}</span>

              {labelDescription && (
                <span className="mt-1 text-xs font-light text-secondary-white">{labelDescription}</span>
              )}
            </div>
          )}
        </label>

        {errorCaption && <div className="text-xs text-primary-error">{errorCaption}</div>}
      </div>
    );
  }
);
