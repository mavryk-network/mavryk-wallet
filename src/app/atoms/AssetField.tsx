import React, { ComponentProps, forwardRef, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { FormField } from 'app/atoms';

const addThousandSeps = (raw: string): string => {
  if (!raw) return raw;
  const parts = raw.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

interface AssetFieldProps extends Omit<ComponentProps<typeof FormField>, 'onChange'> {
  value?: number | string;
  min?: number;
  max?: number;
  assetSymbol?: ReactNode;
  assetDecimals?: number;
  onChange?: (v?: string) => void;
}

const AssetField = forwardRef<HTMLInputElement, AssetFieldProps>(
  (
    {
      value,
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      assetSymbol,
      extraInner,
      assetDecimals = 6,
      onChange,
      onFocus,
      onBlur,
      ...rest
    },
    ref
  ) => {
    const valueStr = useMemo(() => (value === undefined ? '' : new BigNumber(value).toFixed()), [value]);

    const [localValue, setLocalValue] = useState(() => addThousandSeps(valueStr));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
      if (!focused) {
        setLocalValue(addThousandSeps(valueStr));
      }
    }, [setLocalValue, focused, valueStr]);

    const handleChange = useCallback(
      (evt: React.ChangeEvent<HTMLInputElement> & React.ChangeEvent<HTMLTextAreaElement>) => {
        let val = evt.target.value.replace(/ /g, '').replace(/,/g, '.');
        let numVal = new BigNumber(val || 0);
        const indexOfDot = val.indexOf('.');
        if (indexOfDot !== -1 && val.length - indexOfDot > assetDecimals + 1) {
          val = val.substring(0, indexOfDot + assetDecimals + 1);
          numVal = new BigNumber(val);
        }

        if (!numVal.isNaN() && numVal.isGreaterThanOrEqualTo(min) && numVal.isLessThanOrEqualTo(max)) {
          setLocalValue(val);
          if (onChange) {
            onChange(val !== '' ? numVal.toFixed() : undefined);
          }
        }
      },
      [assetDecimals, setLocalValue, min, max, onChange]
    );

    const handleFocus = useCallback(
      (evt: React.FocusEvent<HTMLInputElement> & React.FocusEvent<HTMLTextAreaElement>) => {
        setFocused(true);
        setLocalValue(v => v.replace(/,/g, ''));
        if (onFocus) {
          onFocus(evt);
          if (evt.defaultPrevented) {
            return;
          }
        }
      },
      [setFocused, setLocalValue, onFocus]
    );

    const handleBlur = useCallback(
      (evt: React.FocusEvent<HTMLInputElement> & React.FocusEvent<HTMLTextAreaElement>) => {
        setFocused(false);
        setLocalValue(v => addThousandSeps(v));
        if (onBlur) {
          onBlur(evt);
          if (evt.defaultPrevented) {
            return;
          }
        }
      },
      [setFocused, setLocalValue, onBlur]
    );

    return (
      <FormField
        ref={ref}
        type="text"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        extraInner={extraInner ? extraInner : assetSymbol}
        {...rest}
      />
    );
  }
);

export default AssetField;
