import React, {
  ComponentType,
  FC,
  FunctionComponent,
  MutableRefObject,
  SVGProps,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react';

import classNames from 'clsx';
import { Controller, ControllerProps, EventFunction, FieldError } from 'react-hook-form';

import { Money } from 'app/atoms';
import AssetField from 'app/atoms/AssetField';
import { ReactComponent as CoffeeIcon } from 'app/icons/coffee.svg';
import { ReactComponent as CupIcon } from 'app/icons/cup.svg';
import { ReactComponent as RocketIcon } from 'app/icons/rocket.svg';
import { ReactComponent as SettingsIcon } from 'app/icons/settings.svg';
import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { t, TID } from 'lib/i18n';

import { DropdownSelect } from '../DropdownSelect/DropdownSelect';

import { AdditionalFeeInputSelectors } from './AdditionalFeeInput.selectors';
import { AssetFieldProps, FeeOptionContent } from './additionalFeeInput.shared';

type FeeOption = {
  Icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  descriptionI18nKey: TID;
  type: 'minimal' | 'fast' | 'rocket' | 'custom';
  amount?: number;
};

// used to increase values before operation connfirm
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
};

export const AdditionalGasInput: FC<AdditionalGasInputProps> = props => {
  const { control, id, name, onChange, extraHeight = 0, assetSymbol } = props;

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
      as={AdditionalGasFeeInputContent}
      control={control}
      customFeeInputRef={customFeeInputRef}
      feeOptions={gasOptions}
      onChange={handleChange}
      id={id}
      extraHeight={extraHeight}
      onFocus={focusCustomFeeInput}
      label={t('gasFee')}
      placeholder="0"
      assetSymbol={assetSymbol}
    />
  );
};

export const getFeeOptionId = (option: FeeOption) => option.type;

export type AdditionalFeeInputContentProps = Omit<AssetFieldProps, 'assetSymbol'> & {
  customFeeInputRef: MutableRefObject<HTMLInputElement | null>;
  extraHeight?: number;
  feeOptions: FeeOption[];
  assetSymbol?: string;
};

export const AdditionalGasFeeInputContent: FC<AdditionalFeeInputContentProps> = props => {
  const {
    className,
    containerClassName,
    customFeeInputRef,
    onChange,
    assetSymbol,
    id,
    label,
    labelDescription,
    value,
    extraHeight = 0,
    feeOptions,
    ...restProps
  } = props;

  const [selectedPreset, setSelectedPreset] = useState<FeeOption['type']>(
    feeOptions.find(({ amount }) => amount === value)?.type || 'custom'
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
    <div className="flex flex-col w-full mb-2 flex-grow">
      {label ? (
        <label className="flex flex-col mb-4 leading-tight" htmlFor={`${id}-select`}>
          <span className="text-base-plus text-white">{label}</span>

          {labelDescription && <span className="mt-1 text-sm text-secondary-white">{labelDescription}</span>}
        </label>
      ) : null}

      <div className="relative flex flex-col items-stretch rounded">
        <DropdownSelect
          optionsListClassName="p-0"
          dropdownWrapperClassName="border-none rounded-2xl-plus"
          dropdownButtonClassName="p-2"
          DropdownFaceContent={<FeeOptionFace {...selectedFeeOption} assetSymbol={assetSymbol} />}
          extraHeight={extraHeight}
          optionsProps={{
            options: feeOptions,
            noItemsText: 'No items',
            getKey: getFeeOptionId,
            renderOptionContent: option => <FeeOptionContent {...option} assetSymbol={assetSymbol} />,
            onOptionChange: option => handlePresetSelected(option.type)
          }}
        />

        <AssetField
          containerClassName={classNames(selectedPreset !== 'custom' && 'hidden', 'my-4')}
          id={id}
          onChange={onChange}
          ref={customFeeInputRef}
          assetSymbol={assetSymbol}
          value={value}
          {...restProps}
        />
      </div>
    </div>
  );
};

export const FeeOptionFace: FC<FeeOption & { assetSymbol?: string }> = ({ type, amount, assetSymbol }) => {
  return (
    <section className="flex items-center justify-between w-full text-base-plus text-white">
      <span className="capitalize">{type}</span>
      <div className="flex items-center">
        {amount && (
          <Money cryptoDecimals={5} smallFractionFont={false} tooltip={false}>
            {amount}
          </Money>
        )}
        {assetSymbol && <span className="ml-1 text-sm">{assetSymbol}</span>}
      </div>
    </section>
  );
};
