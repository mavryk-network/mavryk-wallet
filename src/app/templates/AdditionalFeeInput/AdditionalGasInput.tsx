import React, { ComponentType, FC, FunctionComponent, SVGProps, useCallback, useMemo, useState } from 'react';

import classNames from 'clsx';
import { Controller, ControllerProps, EventFunction, FieldError } from 'react-hook-form';

import { Money } from 'app/atoms';
import PlainAssetInput from 'app/atoms/PlainAssetInput';
import { ReactComponent as CoffeeIcon } from 'app/icons/coffee.svg';
import { ReactComponent as CupIcon } from 'app/icons/cup.svg';
import { ReactComponent as RocketIcon } from 'app/icons/rocket.svg';
import { ReactComponent as SettingsIcon } from 'app/icons/settings.svg';
import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { t, TID } from 'lib/i18n';
import { mumavToTz } from 'lib/temple/helpers';

import { DropdownSelect } from '../DropdownSelect/DropdownSelect';

import { AdditionalFeeInputSelectors } from './AdditionalFeeInput.selectors';
import { AssetFieldProps, FeeOptionContent } from './additionalFeeInput.shared';

const MAX_GAS_FEE = 1000;

type FeeOption = {
  Icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  descriptionI18nKey: TID;
  type: 'minimal' | 'fast' | 'rocket' | 'custom';
  amount?: number;
};

export const gasOptions: FeeOption[] = [
  {
    Icon: CoffeeIcon,
    descriptionI18nKey: 'minimalFeeDescription',
    type: 'minimal',
    amount: 1
  },
  {
    Icon: ({ className, ...rest }) => <CupIcon className={classNames('transform scale-95', className)} {...rest} />,
    descriptionI18nKey: 'fastFeeDescription',
    type: 'fast',
    amount: 1.5
  },
  {
    Icon: RocketIcon,
    descriptionI18nKey: 'rocketFeeDescription',
    type: 'rocket',
    amount: 2
  },
  {
    Icon: ({ className, ...rest }) => (
      <SettingsIcon className={classNames('transform scale-95', className)} {...rest} />
    ),
    descriptionI18nKey: 'customFeeDescription',
    type: 'custom'
  }
];

type AdditionalGasInputProps = Pick<ControllerProps<ComponentType>, 'name' | 'control'> & {
  error?: FieldError;
  id: string;
  extraHeight?: number;
  assetSymbol?: string;
  onChange?: (v: [string]) => void;
  feeAmount: number;
  gasFeeError?: boolean;
  valueToShow?: string | number | undefined;
  onChangeValueToShow?: (v?: string) => void | undefined;
  defaultOption?: number;
};

export const AdditionalGasInput: FC<AdditionalGasInputProps> = props => {
  const {
    control,
    id,
    name,
    defaultOption,
    onChange,
    extraHeight = 0,
    assetSymbol,
    feeAmount,
    gasFeeError,
    valueToShow,
    onChangeValueToShow
  } = props;

  const { trackEvent } = useAnalytics();

  const handleChange: EventFunction = event => {
    trackEvent(AdditionalFeeInputSelectors.FeeButton, AnalyticsEventCategory.ButtonPress);

    return onChange?.(event as [string]);
  };

  return (
    <Controller
      id={id}
      name={name}
      as={AdditionalGasFeeInputContent}
      control={control}
      feeOptions={gasOptions}
      defaultOption={defaultOption}
      onChange={handleChange}
      extraHeight={extraHeight}
      assetSymbol={assetSymbol}
      gasFeeError={gasFeeError}
      valueToShow={valueToShow}
      onChangeValueToShow={onChangeValueToShow}
      feeAmount={feeAmount}
    />
  );
};

export const getFeeOptionId = (option: FeeOption) => option.type;
const getMuMavfeeForUi = (amount: number | undefined, feeAmount: number) => {
  return mumavToTz((amount ?? 1) * feeAmount).toNumber();
};

export type AdditionalFeeInputContentProps = Pick<AssetFieldProps, 'defaultValue' | 'onChange' | 'id'> & {
  extraHeight?: number;
  feeOptions: FeeOption[];
  assetSymbol?: string;
  valueToShow?: string | number | undefined;
  onChangeValueToShow?: (v?: string) => void | undefined;
  gasFeeError?: boolean;
  feeAmount: number;
  defaultOption?: number;
};

export const AdditionalGasFeeInputContent: FC<AdditionalFeeInputContentProps> = props => {
  const {
    onChange,
    assetSymbol,
    defaultOption,
    extraHeight = 0,
    feeOptions,
    valueToShow,
    onChangeValueToShow,
    gasFeeError,
    feeAmount
  } = props;
  const [selectedPreset, setSelectedPreset] = useState<FeeOption['type']>(
    feeOptions.find(({ amount }) => amount === defaultOption)?.type || 'custom'
  );

  const handlePresetSelected = useCallback(
    (newType: FeeOption['type']) => {
      setSelectedPreset(newType);
      const option = feeOptions.find(({ type }) => type === newType)!;
      if (option.amount) {
        onChange?.(`${option.amount}`);
      }
    },
    [feeOptions, onChange]
  );

  const selectedFeeOption = useMemo(
    () => feeOptions.find(option => option.type === selectedPreset) ?? feeOptions[0],
    [feeOptions, selectedPreset]
  );

  return (
    <div className="flex flex-col w-full flex-grow">
      <div className="relative flex flex-col items-stretch rounded">
        <DropdownSelect
          optionsListClassName="p-0"
          dropdownWrapperClassName="border-none rounded-2xl-plus"
          dropdownButtonClassName="p-2"
          fontContentWrapperClassname={classNames(gasFeeError && 'border-primary-error', 'bg-primary-bg')}
          DropdownFaceContent={
            <GasFeeOptionFace
              {...selectedFeeOption}
              amount={getMuMavfeeForUi(selectedFeeOption.amount, feeAmount)}
              assetSymbol={assetSymbol}
              value={valueToShow}
              onChange={onChangeValueToShow}
            />
          }
          extraHeight={extraHeight}
          optionsProps={{
            options: feeOptions,
            noItemsText: 'No items',
            getKey: getFeeOptionId,
            renderOptionContent: option => (
              <FeeOptionContent
                {...option}
                amount={option.type !== 'custom' ? getMuMavfeeForUi(option.amount, feeAmount) : undefined}
                assetSymbol={assetSymbol}
              />
            ),
            onOptionChange: option => handlePresetSelected(option.type)
          }}
        />
      </div>
    </div>
  );
};

type GasFeeOptionFaceProps = FeeOption & {
  assetSymbol?: string;
  value?: string | number | undefined;
  onChange?: (v?: string) => void | undefined;
};

export const GasFeeOptionFace: FC<GasFeeOptionFaceProps> = ({ type, amount, assetSymbol, value, onChange }) => {
  const [isInputActive, setIsInputActive] = useState(false);

  // prevent opening dropdown
  const onFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setIsInputActive(true);
  }, []);

  // prevent opening dropdown
  const onClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }, []);

  const onBlur = useCallback(() => {
    setIsInputActive(false);
  }, []);

  return (
    <section className="flex items-center justify-between w-full text-base-plus text-white">
      <span className="capitalize">{type}</span>
      <div className="flex items-center">
        {amount && type !== 'custom' && (
          <Money cryptoDecimals={5} smallFractionFont={false} tooltip={false}>
            {amount}
          </Money>
        )}
        {type === 'custom' && (
          <PlainAssetInput
            value={value}
            onChange={onChange}
            max={MAX_GAS_FEE}
            placeholder={amount?.toString() || '0'}
            onClick={onClick}
            onFocus={onFocus}
            onBlur={onBlur}
            style={{ caretColor: '#5F58FF', width: 100 }}
            className={classNames(
              'appearance-none',
              'bg-transparent',
              'transition ease-in-out duration-200',
              'text-right',
              'text-white text-base-plus',
              'placeholder-text-secondary-white'
            )}
          />
        )}
        {assetSymbol && !isInputActive && <span className="ml-1 text-sm">{assetSymbol}</span>}
      </div>
    </section>
  );
};
