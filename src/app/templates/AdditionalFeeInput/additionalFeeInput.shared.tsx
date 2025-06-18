import React, {
  FC,
  ForwardRefExoticComponent,
  FunctionComponent,
  MutableRefObject,
  SVGProps,
  useCallback,
  useMemo,
  useState
} from 'react';

import classNames from 'clsx';

import AssetField from 'app/atoms/AssetField';
import Money from 'app/atoms/Money';
import Name from 'app/atoms/Name';
import { ReactComponent as CoffeeIcon } from 'app/icons/coffee.svg';
import { ReactComponent as CupIcon } from 'app/icons/cup.svg';
import { ReactComponent as RocketIcon } from 'app/icons/rocket.svg';
import { ReactComponent as SettingsIcon } from 'app/icons/settings.svg';
import { useGasToken } from 'lib/assets/hooks';
import { TID, T } from 'lib/i18n';

import { DropdownSelect } from '../DropdownSelect/DropdownSelect';

export type AssetFieldProps = typeof AssetField extends ForwardRefExoticComponent<infer T> ? T : never;

export type FeeOption = {
  Icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  descriptionI18nKey: TID;
  type: 'minimal' | 'fast' | 'rocket' | 'custom';
  amount?: number;
};

// used for the network fee
export const feeOptions: FeeOption[] = [
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
  }
];

export const getFeeOptionId = (option: FeeOption) => option.type;

export type AdditionalFeeInputContentProps = Omit<AssetFieldProps, 'assetSymbol'> & {
  customFeeInputRef: MutableRefObject<HTMLInputElement | null>;
  extraHeight?: number;
  feeOptions: FeeOption[];
  assetSymbol?: string;
};

export const AdditionalFeeInputContent: FC<AdditionalFeeInputContentProps> = props => {
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
          dropdownButtonClassName="px-4 py-14px"
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
      <div className="flex items-center text-secondary-white text-sm">
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

export const FeeOptionContent: FC<FeeOption & { assetSymbol?: string }> = ({
  descriptionI18nKey,
  amount,
  assetSymbol
}) => {
  return (
    <>
      <div className="p-4 flex items-center justify-between w-full bg-primary-card hover:bg-gray-710">
        <Name className="text-base-plus text-white text-left">
          <T id={descriptionI18nKey} />
        </Name>

        {amount && (
          <div className="ml-2 text-sm text-secondary-white flex items-baseline">
            <Money cryptoDecimals={5} smallFractionFont={false} tooltip={false}>
              {amount}
            </Money>{' '}
            {assetSymbol && <span className="ml-1 text-sm">{assetSymbol}</span>}
          </div>
        )}
      </div>
    </>
  );
};
