import React, { FC, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'clsx';

import AssetField from 'app/atoms/AssetField';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';

import styles from './SlippageToleranceInput.module.css';
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

  // const borderClassName = useMemo(() => {
  //   switch (true) {
  //     case error:
  //       return 'border-red-600';
  //     case assetFieldActive:
  //       return 'border-blue-600';
  //     default:
  //       return 'border-gray-300';
  //   }
  // }, [assetFieldActive, error]);

  useEffect(() => {
    const contentCopyElement = contentCopyRef.current;
    if (contentCopyElement) {
      const contentWidth = Math.max(40, contentCopyElement.getBoundingClientRect().width + 20);
      setInputWidth(contentWidth);
    }
  }, [customPercentageValue]);

  return (
    <div className={styles.toleranceInputWrapper}>
      <DropdownSelect
        dropdownWrapperClassName={classNames('border-none rounded-2xl-plus', styles.toleranceInputWrapper)}
        optionsListClassName="bg-primary-bg"
        dropdownButtonClassName="pr-2 bg-primary-bg gap-0"
        DropdownFaceContent={
          <AssetField
            className={classNames('border-none bg-primary-bg -mb-2 text-right')}
            containerClassName="relative"
            style={{
              padding: '0.125rem 1.175rem 0.125rem 0.25rem',
              minWidth: 'unset'
            }}
            name={name}
            ref={ref}
            value={customPercentageValue ?? value}
            min={0}
            max={MAX_SLIPPAGE_TOLERANCE_PERCENT}
            assetSymbol={
              <span
                className={classNames('absolute text-base-plus right-1 pointer-events-none text-white')}
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
    </div>
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
