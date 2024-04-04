import React, {
  ComponentType,
  FC,
  ForwardRefExoticComponent,
  Fragment,
  FunctionComponent,
  MutableRefObject,
  SVGProps,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { Controller, ControllerProps, EventFunction, FieldError } from 'react-hook-form';

import AssetField from 'app/atoms/AssetField';
import Money from 'app/atoms/Money';
import Name from 'app/atoms/Name';
import { ReactComponent as CoffeeIcon } from 'app/icons/coffee.svg';
import { ReactComponent as CupIcon } from 'app/icons/cup.svg';
import { ReactComponent as RocketIcon } from 'app/icons/rocket.svg';
import { ReactComponent as SettingsIcon } from 'app/icons/settings.svg';
import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { useGasToken } from 'lib/assets/hooks';
import { TID, toLocalFixed, T, t } from 'lib/i18n';

import { DropdownSelect } from '../DropdownSelect/DropdownSelect';

import { AdditionalFeeInputSelectors } from './AdditionalFeeInput.selectors';

type AssetFieldProps = typeof AssetField extends ForwardRefExoticComponent<infer T> ? T : never;

type AdditionalFeeInputProps = Pick<ControllerProps<ComponentType>, 'name' | 'control' | 'onChange'> & {
  assetSymbol: string;
  baseFee?: BigNumber | Error;
  error?: FieldError;
  id: string;
  extraHeight?: number;
};

type FeeOption = {
  Icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  descriptionI18nKey: TID;
  type: 'minimal' | 'fast' | 'rocket' | 'custom';
  amount?: number;
};

const feeOptions: FeeOption[] = [
  {
    Icon: CoffeeIcon,
    descriptionI18nKey: 'minimalFeeDescription',
    type: 'minimal',
    amount: 1e-4
  },
  {
    Icon: ({ className, ...rest }) => <CupIcon className={classNames('transform scale-95', className)} {...rest} />,
    descriptionI18nKey: 'fastFeeDescription',
    type: 'fast',
    amount: 1.5e-4
  },
  {
    Icon: RocketIcon,
    descriptionI18nKey: 'rocketFeeDescription',
    type: 'rocket',
    amount: 2e-4
  },
  {
    Icon: ({ className, ...rest }) => (
      <SettingsIcon className={classNames('transform scale-95', className)} {...rest} />
    ),
    descriptionI18nKey: 'customFeeDescription',
    type: 'custom'
  }
];

const getFeeOptionId = (option: FeeOption) => option.type;

const AdditionalFeeInput: FC<AdditionalFeeInputProps> = props => {
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

export default AdditionalFeeInput;

type AdditionalFeeInputContentProps = AssetFieldProps & {
  customFeeInputRef: MutableRefObject<HTMLInputElement | null>;
  extraHeight?: number;
};

const AdditionalFeeInputContent: FC<AdditionalFeeInputContentProps> = props => {
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
    [onChange]
  );

  const selectedFeeOption = useMemo(
    () => feeOptions.find(option => option.type === selectedPreset) ?? feeOptions[0],
    [selectedPreset]
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
          dropdownButtonClassName="px-4 py-14px"
          DropdownFaceContent={<FeeOptionFace {...selectedFeeOption} />}
          extraHeight={extraHeight}
          optionsProps={{
            options: feeOptions,
            noItemsText: 'No items',
            getKey: getFeeOptionId,
            renderOptionContent: option => <FeeOptionContent {...option} />,
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

const FeeOptionFace: FC<FeeOption> = ({ type, amount }) => {
  const { metadata } = useGasToken();

  return (
    <section className="flex items-center justify-between w-full text-base-plus text-white">
      <span className="capitalize">{type}</span>
      <div className="flex items-center text-secondary-white text-sm">
        {amount && (
          <Money cryptoDecimals={5} smallFractionFont={false}>
            {amount}
          </Money>
        )}
        <span className="ml-1 text-sm">{metadata.symbol}</span>
      </div>
    </section>
  );
};

const FeeOptionContent: FC<FeeOption> = ({ descriptionI18nKey, amount }) => {
  const { metadata } = useGasToken();

  return (
    <>
      <div className="p-4 flex items-center justify-between w-full bg-primary-card hover:bg-gray-710">
        <Name className="text-base-plus text-white text-left">
          <T id={descriptionI18nKey} />
        </Name>

        {amount && (
          <div className="ml-2 text-sm text-secondary-white flex items-baseline">
            <Money cryptoDecimals={5} smallFractionFont={false}>
              {amount}
            </Money>{' '}
            <span className="ml-1 text-sm">{metadata.symbol}</span>
          </div>
        )}
      </div>
    </>
  );
};
