import React, { ChangeEventHandler, ReactNode, FC, Dispatch, SetStateAction } from 'react';

import { isDefined } from '@rnw-community/shared';
import classNames from 'clsx';

import AssetField from 'app/atoms/AssetField';
import DropdownWrapper from 'app/atoms/DropdownWrapper';
import Spinner from 'app/atoms/Spinner/Spinner';
import { ReactComponent as ChevronDownIcon } from 'app/icons/chevron-down.svg';
import { ReactComponent as SearchIcon } from 'app/icons/search.svg';
import { AnalyticsEventCategory, setTestID, useAnalytics } from 'lib/analytics';
import { t } from 'lib/i18n';
import Popper from 'lib/ui/Popper';
import { sameWidthModifiers } from 'lib/ui/same-width-modifiers';
import { merge } from 'lib/utils/merge';

interface Props<T> {
  DropdownFaceContent: ReactNode;
  Input?: ReactNode;
  optionsListClassName?: string;
  dropdownButtonClassName?: string;
  dropdownWrapperClassName?: string;
  fontContentWrapperClassname?: string;
  searchProps?: SelectSearchProps;
  optionsProps: SelectOptionsPropsBase<T>;
  extraHeight?: number;
  testIds?: {
    dropdownTestId?: string;
  };
}

export const DropdownSelect = <T extends unknown>({
  Input,
  searchProps,
  optionsProps,
  extraHeight = 0,
  testIds,
  DropdownFaceContent,
  optionsListClassName,
  dropdownButtonClassName,
  dropdownWrapperClassName,
  fontContentWrapperClassname
}: Props<T>) => {
  const isInputDefined = isDefined(Input);
  const { trackEvent } = useAnalytics();

  const trackDropdownClick = () => {
    if (testIds?.dropdownTestId) {
      trackEvent(testIds?.dropdownTestId, AnalyticsEventCategory.DropdownOpened);
    }
  };

  return (
    <Popper
      placement="bottom"
      strategy="fixed"
      modifiers={sameWidthModifiers}
      fallbackPlacementsEnabled={false}
      popup={({ opened, setOpened }) => (
        <SelectOptions
          optionsListClassName={optionsListClassName}
          dropdownWrapperClassName={dropdownWrapperClassName}
          opened={opened}
          setOpened={setOpened}
          {...optionsProps}
        />
      )}
    >
      {({ ref, opened, toggleOpened }) => (
        <>
          <div ref={ref as unknown as React.RefObject<HTMLDivElement>} {...setTestID(testIds?.dropdownTestId)}>
            {opened && searchProps ? (
              <SelectSearch {...searchProps} className={dropdownButtonClassName} />
            ) : (
              <div
                className={merge(
                  'box-border w-full flex items-center justify-between border rounded-md border-gray-50 overflow-hidden max-h-18',
                  fontContentWrapperClassname
                )}
              >
                <button
                  type="button"
                  className={merge(
                    'flex gap-2 items-center max-h-18',
                    isInputDefined ? 'border-r border-divider' : 'w-full justify-between',
                    dropdownButtonClassName
                  )}
                  onClick={() => {
                    toggleOpened();
                    trackDropdownClick();
                  }}
                >
                  {DropdownFaceContent}
                  <ChevronDownIcon className="text-white stroke-current stroke-2 h-4 w-4" />
                </button>
                {Input}
              </div>
            )}
          </div>

          {opened && extraHeight > 0 ? <div style={{ height: extraHeight, visibility: 'hidden' }} /> : null}
        </>
      )}
    </Popper>
  );
};
export interface SelectOptionsPropsBase<Type> {
  options: Array<Type>;
  noItemsText: ReactNode;
  isLoading?: boolean;
  optionsListClassName?: string;
  dropdownWrapperClassName?: string;
  getKey: (option: Type) => string;
  onOptionChange: (newValue: Type) => void;
  renderOptionContent: (option: Type) => ReactNode;
}
interface SelectOptionsProps<Type> extends SelectOptionsPropsBase<Type> {
  opened: boolean;
  setOpened: Dispatch<SetStateAction<boolean>>;
}

const SelectOptions = <Type extends unknown>({
  opened,
  options,
  noItemsText,
  isLoading,
  optionsListClassName,
  dropdownWrapperClassName,
  getKey,
  onOptionChange,
  setOpened,
  renderOptionContent
}: SelectOptionsProps<Type>) => {
  const handleOptionClick = (newValue: Type) => {
    onOptionChange(newValue);
    setOpened(false);
  };

  return (
    <DropdownWrapper
      opened={opened}
      className={classNames('origin-top overflow-x-hidden overflow-y-auto no-scrollbar', dropdownWrapperClassName)}
      style={{
        // maxHeight: '15.125rem',
        backgroundColor: '#010101',
        borderColor: '#44494A'
      }}
    >
      {(options.length === 0 || isLoading) && (
        <div className="my-8 flex flex-col items-center justify-center text-white">
          {isLoading ? (
            <Spinner className="w-12" theme="primary" />
          ) : (
            <p className="flex items-center justify-center text-white text-base font-light">
              <span>{noItemsText}</span>
            </p>
          )}
        </div>
      )}

      <ul className={optionsListClassName}>
        {options.map(option => (
          <li key={getKey(option)}>
            <button
              type="button"
              className="w-full"
              disabled={(option as any).disabled}
              onClick={() => handleOptionClick(option)}
            >
              {renderOptionContent(option)}
            </button>
          </li>
        ))}
      </ul>
    </DropdownWrapper>
  );
};

interface SelectSearchProps {
  testId?: string;
  className?: string;
  searchValue: string;
  tokenIdValue?: string;
  showTokenIdInput?: boolean;
  onSearchChange: ChangeEventHandler<HTMLInputElement>;
  onTokenIdChange?: (newValue: number | string | undefined) => void;
}
const SelectSearch: FC<SelectSearchProps> = ({
  testId,
  className,
  searchValue,
  tokenIdValue,
  showTokenIdInput = false,
  onSearchChange,
  onTokenIdChange
}) => {
  return (
    <div
      className={classNames(
        'w-full flex items-center transition ease-in-out duration-200 border rounded-md max-h-18',
        className
      )}
    >
      <div className="items-center mr-3">
        <SearchIcon className={classNames('w-4 h-auto text-secondary-white stroke-current')} />
      </div>

      <div className="text-lg flex flex-1 items-stretch">
        <div className="flex-1 flex items-stretch mr-2">
          <input
            autoFocus
            value={searchValue}
            className="w-full bg-transparent text-base-plus text-white placeholder-secondary-white"
            placeholder={t('swapTokenSearchInputPlaceholder')}
            onChange={onSearchChange}
            {...setTestID(testId)}
          />
        </div>

        {showTokenIdInput && (
          <div className="w-24 flex items-stretch border border-gray-50">
            <AssetField
              autoFocus
              value={tokenIdValue}
              assetDecimals={0}
              fieldWrapperBottomMargin={false}
              placeholder={t('tokenId')}
              style={{ borderRadius: 0 }}
              containerStyle={{ flexDirection: 'row' }}
              containerClassName="items-stretch"
              className="text-base-plus border-none bg-opacity-0 focus:shadow-none"
              onChange={onTokenIdChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};
