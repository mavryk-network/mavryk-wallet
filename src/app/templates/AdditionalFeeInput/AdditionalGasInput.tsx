import React, { ComponentType, FC, useCallback, useRef } from 'react';

import { Controller, ControllerProps, EventFunction, FieldError } from 'react-hook-form';

import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { t } from 'lib/i18n';

import { AdditionalFeeInputSelectors } from './AdditionalFeeInput.selectors';
import { AdditionalFeeInputContent, gasOptions } from './additionalFeeInput.shared';

type AdditionalGasInputProps = Pick<ControllerProps<ComponentType>, 'name' | 'control'> & {
  error?: FieldError;
  id: string;
  extraHeight?: number;
  onChange?: (v: [string]) => void;
};

export const AdditionalGasInput: FC<AdditionalGasInputProps> = props => {
  const { control, id, name, onChange, extraHeight = 0 } = props;

  const { trackEvent } = useAnalytics();

  const customFeeInputRef = useRef<HTMLInputElement>(null);
  const focusCustomFeeInput = useCallback(() => {
    customFeeInputRef.current?.focus();
  }, []);

  const handleChange: EventFunction = event => {
    trackEvent(AdditionalFeeInputSelectors.FeeButton, AnalyticsEventCategory.ButtonPress);

    return onChange?.(event as [string]);
  };

  return (
    <Controller
      name={name}
      as={AdditionalFeeInputContent}
      control={control}
      customFeeInputRef={customFeeInputRef}
      feeOptions={gasOptions}
      onChange={handleChange}
      id={id}
      extraHeight={extraHeight}
      onFocus={focusCustomFeeInput}
      label={t('gasFee')}
      placeholder="0"
    />
  );
};
