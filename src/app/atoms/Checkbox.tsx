import React, { forwardRef, InputHTMLAttributes, useCallback, useEffect, useMemo, useState } from 'react';

import clsx from 'clsx';

import { ReactComponent as OkIcon } from 'app/icons/ok.svg';
import { TestIDProps, setTestID, useAnalytics, AnalyticsEventCategory } from 'lib/analytics';
import { blurHandler, checkedHandler, focusHandler } from 'lib/ui/inputHandlers';

export interface CheckboxProps
  extends TestIDProps,
    Pick<InputHTMLAttributes<HTMLInputElement>, 'name' | 'checked' | 'className' | 'onFocus' | 'onBlur' | 'onClick'> {
  overrideClassNames?: string;
  errored?: boolean;
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  IconFromProps?: ImportedSVGComponent;
  iconClassName?: string;
  shouldFocus?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      overrideClassNames,
      errored = false,
      className,
      checked,
      onChange,
      onFocus,
      onBlur,
      testID,
      testIDProperties,
      IconFromProps,
      iconClassName,
      shouldFocus = true,
      ...rest
    },
    ref
  ) => {
    const [localChecked, setLocalChecked] = useState(() => checked ?? false);

    const { trackEvent } = useAnalytics();

    useEffect(() => {
      setLocalChecked(prevChecked => checked ?? prevChecked);
    }, [setLocalChecked, checked]);

    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const { checked: toChecked } = event.target;
        checkedHandler(event, onChange && (() => onChange(toChecked, event)), setLocalChecked);

        testID && trackEvent(testID, AnalyticsEventCategory.CheckboxChange, { toChecked, ...testIDProperties });
      },
      [onChange, setLocalChecked, trackEvent, testID, testIDProperties]
    );

    /**
     * Focus handling
     */
    const [localFocused, setLocalFocused] = useState(false);

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => focusHandler(e, onFocus!, setLocalFocused),
      [onFocus, setLocalFocused]
    );
    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => blurHandler(e, onBlur!, setLocalFocused),
      [onBlur, setLocalFocused]
    );

    const classNameMemo = useMemo(
      () =>
        clsx(
          'flex justify-center items-center flex-shrink-0',
          'text-white border overflow-hidden',
          'transition ease-in-out duration-200 disable-outline-for-click',
          localFocused && shouldFocus && 'shadow-outline',
          (() => {
            switch (true) {
              case localChecked:
                return 'border-accent-blue';
              case localFocused:
                return 'border-eccent-blue';
              case errored:
                return 'border-primary-error';
              default:
                return 'border-divider';
            }
          })(),
          overrideClassNames || 'h-6 w-6 rounded-md'
        ),
      [localChecked, localFocused, errored, overrideClassNames]
    );

    const Icon = IconFromProps ? IconFromProps : OkIcon;

    return (
      <div className={classNameMemo} {...setTestID(testID)}>
        <input
          ref={ref}
          type="checkbox"
          className={clsx('sr-only', className)}
          checked={localChecked}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />

        <Icon
          className={clsx(
            iconClassName ? iconClassName : 'h-4/6 w-4/6 stroke-2 stroke-accent-blue pointer-events-none',
            localChecked ? 'block' : 'hidden'
          )}
        />
      </div>
    );
  }
);

export default Checkbox;
