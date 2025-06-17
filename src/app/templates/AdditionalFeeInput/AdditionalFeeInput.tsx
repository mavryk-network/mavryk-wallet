import React, { ComponentType, FC, Fragment, useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { Controller, ControllerProps, EventFunction, FieldError } from 'react-hook-form';

import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { toLocalFixed, T, t } from 'lib/i18n';

import { AdditionalFeeInputSelectors } from './AdditionalFeeInput.selectors';
import { AdditionalFeeInputContent, feeOptions } from './additionalFeeInput.shared';

type AdditionalFeeInputProps = Pick<ControllerProps<ComponentType>, 'name' | 'control' | 'onChange'> & {
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

  const handleChange: EventFunction = event => {
    trackEvent(AdditionalFeeInputSelectors.FeeButton, AnalyticsEventCategory.ButtonPress);

    return onChange?.(event);
  };

  return (
    <Controller
      feeOptions={feeOptions}
      name={name}
      as={AdditionalFeeInputContent}
      control={control}
      customFeeInputRef={customFeeInputRef}
      onChange={handleChange}
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
  );
};
