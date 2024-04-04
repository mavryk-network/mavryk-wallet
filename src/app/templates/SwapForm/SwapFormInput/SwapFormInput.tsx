import React, { FC, ReactNode, useMemo, useState } from 'react';

import { isDefined } from '@rnw-community/shared';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import AssetField from 'app/atoms/AssetField';
import Money from 'app/atoms/Money';
import { useTokensListingLogic } from 'app/hooks/use-tokens-listing-logic';
import { AssetIcon } from 'app/templates/AssetIcon';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import InFiat from 'app/templates/InFiat';
import { InputContainer } from 'app/templates/InputContainer/InputContainer';
import { setTestID, useFormAnalytics } from 'lib/analytics';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { T, t, toLocalFormat } from 'lib/i18n';
import { EMPTY_BASE_METADATA, useAssetMetadata, AssetMetadataBase, useGetTokenMetadata } from 'lib/metadata';
import { useAvailableRoute3TokensSlugs } from 'lib/route3/assets';
import { useAccount } from 'lib/temple/front';

import { AssetOption } from './AssetsMenu/AssetOption';
import { PercentageButton } from './PercentageButton/PercentageButton';
import styles from './SwapFormInput.module.css';
import { SwapFormInputProps } from './SwapFormInput.props';

const EXCHANGE_XTZ_RESERVE = new BigNumber('0.3');
const PERCENTAGE_BUTTONS = [25, 50, 75, 100];
const LEADING_ASSETS = [MAV_TOKEN_SLUG];

const renderOptionContent = (option: string, isSelected: boolean) => (
  <AssetOption assetSlug={option} selected={isSelected} />
);

export const SwapFormInput: FC<SwapFormInputProps> = ({
  className,
  value,
  label,
  error,
  name,
  amountInputDisabled,
  testIDs,
  onChange,
  noItemsText = 'No items'
}) => {
  const { trackChange } = useFormAnalytics('SwapForm');

  const { assetSlug, amount } = value;
  const isTezosSlug = assetSlug === MAV_TOKEN_SLUG;
  const assetSlugWithFallback = assetSlug ?? MAV_TOKEN_SLUG;
  const isAssestSelected = Boolean(assetSlug);

  const assetMetadataWithFallback = useAssetMetadata(assetSlugWithFallback)!;
  const assetMetadata = useMemo(
    () => (assetSlug ? assetMetadataWithFallback : EMPTY_BASE_METADATA),
    [assetSlug, assetMetadataWithFallback]
  );
  const getTokenMetadata = useGetTokenMetadata();

  const account = useAccount();
  const { value: balance } = useBalance(assetSlugWithFallback, account.publicKeyHash);

  const { isLoading, route3tokensSlugs } = useAvailableRoute3TokensSlugs();
  const { filteredAssets, setSearchValue, setTokenId } = useTokensListingLogic(
    route3tokensSlugs,
    name === 'input',
    LEADING_ASSETS
  );

  const [selectedPercentage, setSelectedPercentage] = useState(PERCENTAGE_BUTTONS[0]);

  const maxAmount = useMemo(() => {
    if (!assetSlug) {
      return new BigNumber(0);
    }

    const maxSendAmount = isTezosSlug ? balance?.minus(EXCHANGE_XTZ_RESERVE) : balance;

    return maxSendAmount ?? new BigNumber(0);
  }, [assetSlug, isTezosSlug, balance]);

  const handleAmountChange = (newAmount?: BigNumber) =>
    onChange({
      assetSlug,
      amount: newAmount
    });

  const handlePercentageClick = (percentage: number) => {
    if (!assetSlug) {
      return;
    }
    const newAmount = maxAmount
      .multipliedBy(percentage)
      .div(100)
      .decimalPlaces(assetMetadata.decimals, BigNumber.ROUND_DOWN);

    handleAmountChange(newAmount);
    setSelectedPercentage(percentage);
  };

  const handleSelectedAssetChange = (newAssetSlug: string) => {
    const newAssetMetadata = getTokenMetadata(newAssetSlug)!;
    const newAmount = amount?.decimalPlaces(newAssetMetadata.decimals, BigNumber.ROUND_DOWN);

    onChange({
      assetSlug: newAssetSlug,
      amount: newAmount
    });
    setSearchValue('');
    setTokenId(undefined);

    trackChange({ [name]: assetMetadata.symbol }, { [name]: newAssetMetadata.symbol });
  };

  const prettyError = useMemo(() => {
    if (!error) {
      return error;
    }
    if (error.startsWith('maximalAmount')) {
      const amountAsset = new BigNumber(error.split(':')[1]);
      return t('maximalAmount', amountAsset.toFixed());
    }

    return error;
  }, [error]);

  return (
    <div className={className}>
      <InputContainer
        header={
          <SwapInputHeader
            label={label}
            selectedAssetSlug={assetSlugWithFallback}
            selectedAssetSymbol={assetMetadataWithFallback.symbol}
            isAssestSelected={isAssestSelected}
          />
        }
        footer={
          <div className={classNames('flex flex-col items-end justify-end text-right')}>
            {prettyError && <div className="text-primary-error text-sm w-full mt-1">{prettyError}</div>}
            <SwapFooter
              amountInputDisabled={Boolean(amountInputDisabled)}
              selectedAssetSlug={assetSlugWithFallback}
              handlePercentageClick={handlePercentageClick}
              selectedPercentage={selectedPercentage}
            />
          </div>
        }
      >
        <DropdownSelect
          testIds={{
            dropdownTestId: testIDs?.dropdown
          }}
          fontContentWrapperClassname={classNames(
            'bg-primary-card max-h-66px border border-transparent rounded-xl border',
            prettyError ? 'border-primary-error' : 'border-transparent'
          )}
          dropdownButtonClassName={classNames(
            'p-0 m-4 min-h-9 min-w-85 flex justify-between pr-4',
            styles.extraFaceContentWrapper
          )}
          dropdownWrapperClassName="border-none rounded-2xl-plus max-h-44"
          optionsListClassName="bg-primary-card "
          DropdownFaceContent={
            <SwapDropdownFace
              testId={testIDs?.assetDropDownButton}
              selectedAssetSlug={assetSlug}
              selectedAssetMetadata={assetMetadata}
            />
          }
          Input={
            <SwapInput
              testId={testIDs?.input}
              amount={value.amount}
              amountInputDisabled={Boolean(amountInputDisabled)}
              onChange={handleAmountChange}
              selectedAssetSlug={assetSlugWithFallback}
              selectedAssetMetadata={assetMetadata}
            />
          }
          optionsProps={{
            isLoading,
            options: filteredAssets,
            noItemsText,
            getKey: option => option,
            renderOptionContent: option => renderOptionContent(option, value.assetSlug === option),
            onOptionChange: handleSelectedAssetChange
          }}
        />
      </InputContainer>
    </div>
  );
};

interface SwapFieldProps {
  testId?: string;
  selectedAssetSlug?: string;
  selectedAssetMetadata: AssetMetadataBase;
}

const SwapDropdownFace: FC<SwapFieldProps> = ({ testId, selectedAssetSlug, selectedAssetMetadata }) => (
  <div {...setTestID(testId)} className="max-h-66px">
    {selectedAssetSlug ? (
      <div className="flex items-center gap-2 align-center">
        <AssetIcon assetSlug={selectedAssetSlug} size={32} className="w-8" />
        <span className="text-white text-base-plus overflow-hidden leading-5 text-ellipsis">
          {selectedAssetMetadata.symbol}
        </span>
      </div>
    ) : (
      <div className="w-24 mr-2 text-secondary-white text-base-plus">
        <div className="w-12">
          <T id="token" />
        </div>
      </div>
    )}
  </div>
);

interface SwapInputProps extends SwapFieldProps {
  testId?: string;
  amount: BigNumber | undefined;
  amountInputDisabled: boolean;
  onChange: (value?: BigNumber) => void;
}
const SwapInput: FC<SwapInputProps> = ({
  amount,
  amountInputDisabled,
  selectedAssetSlug,
  selectedAssetMetadata,
  testId,
  onChange
}) => {
  const handleAmountChange = (newAmount?: string) =>
    onChange(Boolean(newAmount) && isDefined(newAmount) ? new BigNumber(newAmount) : undefined);

  return (
    <div
      className={classNames(
        'flex-1 px-2 flex items-center justify-between rounded-r-md max-h-66px',
        amountInputDisabled && 'bg-primary-card'
      )}
    >
      <div className="h-full flex-1 flex items-end justify-center flex-col">
        <AssetField
          autoFocus
          testID={testId}
          value={amount?.toFixed(8).toString()}
          className={classNames(
            'text-base-plus text-right border-none bg-opacity-0 pl-0 focus:shadow-none',
            amount?.isEqualTo(0) ? 'text-secondary-white' : 'text-white'
          )}
          style={{ padding: 0, borderRadius: 0 }}
          placeholder={toLocalFormat(0, { decimalPlaces: 2 })}
          min={0}
          max={9999999999999}
          disabled={amountInputDisabled}
          assetDecimals={selectedAssetMetadata.decimals}
          fieldWrapperBottomMargin={false}
          onChange={handleAmountChange}
        />

        <InFiat assetSlug={selectedAssetSlug} volume={selectedAssetSlug ? amount ?? 0 : 0} smallFractionFont={false}>
          {({ balance, symbol }) => (
            <div className="text-secondary-white flex text-sm">
              <span>≈&nbsp;</span>
              {balance}&nbsp;
              <span>{symbol}</span>
            </div>
          )}
        </InFiat>
      </div>
    </div>
  );
};

const SwapInputHeader: FC<{
  label: ReactNode;
  selectedAssetSlug: string;
  selectedAssetSymbol: string;
  isAssestSelected: boolean;
}> = ({ selectedAssetSlug, selectedAssetSymbol, label, isAssestSelected }) => {
  const account = useAccount();
  const balance = useBalance(selectedAssetSlug, account.publicKeyHash);

  return (
    <div className="w-full flex items-center justify-between mb-3">
      <span className="text-base-plus text-white">{label}</span>

      {isAssestSelected && (
        <span className="text-sm text-secondary-white flex items-baseline">
          <span className="mr-1">
            <T id="balance" />:
          </span>
          {balance && (
            <span className={classNames('text-sm mr-1 text-secondary-white')}>
              <Money smallFractionFont={false} fiat={false}>
                {balance.value ?? 0}
              </Money>
            </span>
          )}
          <span>{selectedAssetSymbol}</span>
        </span>
      )}
    </div>
  );
};

const SwapFooter: FC<{
  amountInputDisabled: boolean;
  selectedPercentage: number;
  selectedAssetSlug: string;
  handlePercentageClick: (percentage: number) => void;
}> = ({ amountInputDisabled, selectedPercentage, selectedAssetSlug, handlePercentageClick }) => {
  const account = useAccount();
  const balance = useBalance(selectedAssetSlug, account.publicKeyHash);

  return amountInputDisabled ? null : (
    <div className="flex mt-2">
      {PERCENTAGE_BUTTONS.map(percentage => (
        <PercentageButton
          disabled={!balance.value}
          key={percentage}
          percentage={percentage}
          selectedPercentage={selectedPercentage}
          onClick={handlePercentageClick}
        />
      ))}
    </div>
  );
};
