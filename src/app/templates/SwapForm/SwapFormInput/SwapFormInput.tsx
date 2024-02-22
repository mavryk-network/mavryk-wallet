import React, { FC, ReactNode, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import AssetField from 'app/atoms/AssetField';
import Money from 'app/atoms/Money';
import { AssetIcon } from 'app/templates/AssetIcon';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import InFiat from 'app/templates/InFiat';
import { InputContainer } from 'app/templates/InputContainer/InputContainer';
import { setTestID, useFormAnalytics } from 'lib/analytics';
import { TEZ_TOKEN_SLUG } from 'lib/assets';
import { useFilteredAssetsSlugs } from 'lib/assets/use-filtered';
import { T, t, toLocalFormat } from 'lib/i18n';
import { EMPTY_BASE_METADATA, useAssetMetadata, AssetMetadataBase } from 'lib/metadata';
import { useAvailableRoute3TokensSlugs } from 'lib/route3/assets';
import { useAccount, useBalance, useGetTokenMetadata, useOnBlock } from 'lib/temple/front';

import { AssetOption } from './AssetsMenu/AssetOption';
import { PercentageButton } from './PercentageButton/PercentageButton';
import styles from './SwapFormInput.module.css';
import { SwapFormInputProps } from './SwapFormInput.props';

const EXCHANGE_XTZ_RESERVE = new BigNumber('0.3');
const PERCENTAGE_BUTTONS = [25, 50, 75, 100];
const LEADING_ASSETS = [TEZ_TOKEN_SLUG];

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
  const isTezosSlug = assetSlug === 'tez';
  const assetSlugWithFallback = assetSlug ?? 'tez';

  const assetMetadataWithFallback = useAssetMetadata(assetSlugWithFallback)!;
  const assetMetadata = useMemo(
    () => (assetSlug ? assetMetadataWithFallback : EMPTY_BASE_METADATA),
    [assetSlug, assetMetadataWithFallback]
  );
  const getTokenMetadata = useGetTokenMetadata();

  const account = useAccount();
  const balance = useBalance(assetSlugWithFallback, account.publicKeyHash, { suspense: false });
  useOnBlock(_ => balance.mutate());

  const { isLoading, route3tokensSlugs } = useAvailableRoute3TokensSlugs();
  const { filteredAssets, setSearchValue, setTokenId } = useFilteredAssetsSlugs(
    route3tokensSlugs,
    name === 'input',
    LEADING_ASSETS
  );

  const maxAmount = useMemo(() => {
    if (!assetSlug) {
      return new BigNumber(0);
    }

    const maxSendAmount = isTezosSlug ? balance.data?.minus(EXCHANGE_XTZ_RESERVE) : balance.data;

    return maxSendAmount ?? new BigNumber(0);
  }, [assetSlug, isTezosSlug, balance.data]);

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

  // const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
  //   setTokenId(undefined);
  //   setSearchValue(e.target.value);
  // };

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
          />
        }
        footer={
          <div className={classNames('w-full flex items-center', prettyError ? 'justify-between' : 'justify-end')}>
            {prettyError && <div className="text-primary-error text-xs">{prettyError}</div>}
            <SwapFooter
              amountInputDisabled={Boolean(amountInputDisabled)}
              selectedAssetSlug={assetSlugWithFallback}
              handlePercentageClick={handlePercentageClick}
            />
          </div>
        }
      >
        <DropdownSelect
          testIds={{
            dropdownTestId: testIDs?.dropdown
          }}
          fontContentWrapperClassname="bg-primary-card max-h-66px border border-transparent rounded-xl"
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
          value={amount?.toString()}
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

const SwapInputHeader: FC<{ label: ReactNode; selectedAssetSlug: string; selectedAssetSymbol: string }> = ({
  selectedAssetSlug,
  selectedAssetSymbol,
  label
}) => {
  const account = useAccount();
  const balance = useBalance(selectedAssetSlug, account.publicKeyHash, { suspense: false });
  useOnBlock(_ => balance.mutate());

  return (
    <div className="w-full flex items-center justify-between mb-3">
      <span className="text-base-plus text-white">{label}</span>

      {selectedAssetSlug && (
        <span className="text-sm text-secondary-white flex items-baseline">
          <span className="mr-1">
            <T id="balance" />:
          </span>
          {balance.data && (
            <span className={classNames('text-sm mr-1 text-secondary-white')}>
              <Money smallFractionFont={false} fiat={false}>
                {balance.data}
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
  selectedAssetSlug: string;
  handlePercentageClick: (percentage: number) => void;
}> = ({ amountInputDisabled, selectedAssetSlug, handlePercentageClick }) => {
  const account = useAccount();
  const balance = useBalance(selectedAssetSlug, account.publicKeyHash, { suspense: false });
  useOnBlock(_ => balance.mutate());

  return amountInputDisabled ? null : (
    <div className="flex mt-2">
      {PERCENTAGE_BUTTONS.map(percentage => (
        <PercentageButton
          disabled={!balance.data}
          key={percentage}
          percentage={percentage}
          onClick={handlePercentageClick}
        />
      ))}
    </div>
  );
};
