import React, { FC, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'clsx';

import AssetField from 'app/atoms/AssetField';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';

import { MAX_SLIPPAGE_TOLERANCE_PERCENT } from './SlippageToleranceInput.validation';

interface Props {
  name: string;
  value?: number;
  error?: boolean;
  onChange: (newValue?: number) => void;
}

const SLIPPAGE_PRESETS = [0.25, 0.5, 0.75];

export const SlippageToleranceInput = forwardRef<HTMLInputElement, Props>(({ name, value, error, onChange }, ref) => {
  const [customPercentageValue, setCustomPercentageValue] = useState<number>();
  const [inputWidth, setInputWidth] = useState(40);
  const contentCopyRef = useRef<HTMLDivElement | null>(null);

  const handlePresetClick = useCallback(
    (newValue: number) => {
      setCustomPercentageValue(undefined);
      onChange(newValue);
    },
    [onChange]
  );

  const handleCustomPercentageChange = useCallback(
    (newValue?: string) => {
      const newValueNum = newValue ? Number(newValue) : undefined;
      setCustomPercentageValue(newValueNum);
      onChange(newValueNum);
    },
    [onChange]
  );

  const assetFieldActive = !value || !SLIPPAGE_PRESETS.includes(value);

  const borderClassName = useMemo(() => {
    switch (true) {
      case error:
        return 'border-red-600';
      case assetFieldActive:
        return 'border-blue-600';
      default:
        return 'border-gray-300';
    }
  }, [assetFieldActive, error]);

  useEffect(() => {
    const contentCopyElement = contentCopyRef.current;
    if (contentCopyElement) {
      const contentWidth = Math.max(40, contentCopyElement.getBoundingClientRect().width + 20);
      setInputWidth(contentWidth);
    }
  }, [customPercentageValue]);

  return (
    <DropdownSelect
      dropdownWrapperClassName="border-none rounded-2xl-plus"
      optionsListClassName="bg-primary-card "
      DropdownFaceContent={
        <AssetField
          className={classNames('rounded-md border bg-opacity-0 -mb-2 text-right', borderClassName)}
          containerClassName="relative"
          style={{
            padding: '2px 0.975rem 2px 0.25rem',
            minWidth: 'unset'
          }}
          name={name}
          ref={ref}
          value={customPercentageValue}
          min={0}
          max={MAX_SLIPPAGE_TOLERANCE_PERCENT}
          assetSymbol={
            <span
              className={classNames(
                'absolute text-base-plus right-1 pointer-events-none',
                assetFieldActive ? 'text-white' : 'text-secondary-white'
              )}
              style={{ top: '0.125rem' }}
            >
              %
            </span>
          }
          extraInnerWrapper="none"
          assetDecimals={2}
          onChange={handleCustomPercentageChange}
        />
      }
      optionsProps={{
        options: SLIPPAGE_PRESETS,
        getKey: option => String(option),
        noItemsText: 'No Items',
        renderOptionContent: option => renderOptionContent(option, value === option),
        onOptionChange: handlePresetClick
      }}
    />
  );
});

const renderOptionContent = (percentage: number, selected: boolean) => {
  return (
    <div
      className={classNames(
        'p-4 hover:bg-gray-710 text-base-plus text-white',
        selected ? 'bg-gray-710' : 'bg-primary-card'
      )}
    >
      {percentage}%
    </div>
  );
};
