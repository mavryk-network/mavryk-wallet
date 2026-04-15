import React, { FC, Fragment, useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { Controller, FieldError, Control } from 'react-hook-form';

import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { toLocalFixed, T, t } from 'lib/i18n';

import { AdditionalFeeInputSelectors } from './AdditionalFeeInput.selectors';
import { AdditionalFeeInputContent, feeOptions } from './additionalFeeInput.shared';

type AdditionalFeeInputProps = {
  name: string;
  control: Control<any>;
  onChange?: (event: any) => any;
  assetSymbol: string;
  baseFee?: BigNumber | Error;
  error?: FieldError;
  id: string;
  extraHeight?: number;
};

export const AdditionalFeeInput: FC<AdditionalFeeInputProps> = props => {
  const { assetSymbol, baseFee, control, id, name, onChange, extraHeight = 0 } = props;
  const { trackEvent } = useAnalytics();

  const customFeeInputRef = useRef<HTMLInputElement>(null);
  const focusCustomFeeInput = useCallback(() => {
    customFeeInputRef.current?.focus();
  }, []);

  const handleChange = (val: any) => {
    trackEvent(AdditionalFeeInputSelectors.FeeButton, AnalyticsEventCategory.ButtonPress);
    onChange?.(val);
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <AdditionalFeeInputContent
          value={field.value}
          onChange={(val: any) => {
            handleChange(val);
            field.onChange(val);
          }}
          feeOptions={feeOptions}
          customFeeInputRef={customFeeInputRef}
          id={id}
          extraHeight={extraHeight}
          assetSymbol={assetSymbol}
          onFocus={focusCustomFeeInput}
          label={t('networkFee')}
          labelDescription={
            baseFee instanceof BigNumber && (
              <T
                id="feeInputDescription"
                substitutions={[
                  <Fragment key={0}>
                    <span className="font-normal">{toLocalFixed(baseFee)}</span>
                  </Fragment>
                ]}
              />
            )
          }
          placeholder="0"
        />
      )}
    />
  );
};
