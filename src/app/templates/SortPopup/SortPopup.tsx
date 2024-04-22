import React, { FC, ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

import classNames from 'clsx';

import { RadioButton } from 'app/atoms/RadioButton';
import { Switcher } from 'app/atoms/Switcher';
import { useAppEnv } from 'app/env';
import { ReactComponent as SortIcon } from 'app/icons/sort.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { T } from 'lib/i18n';

import { PopupModalWithTitle } from '../PopupModalWithTitle';

import { SortListItemType, SortPopupContext } from './SortPopup.types';

type SortPopupContentProps = {
  items: SortListItemType[];
  on?: boolean;
  toggle?: () => void;
  title?: ReactNode;
  alternativeLogic?: boolean;
};

type SortPopupProps = { children: ReactNode; isOpened?: boolean };

// Sort popup context
const sortPopupContext = createContext<SortPopupContext>(undefined!);

export const SortPopup: FC<SortPopupProps> = ({ children, isOpened = false }) => {
  const [opened, setOpened] = useState(isOpened);

  const close = useCallback(() => {
    setOpened(false);
  }, []);

  const open = useCallback(() => {
    setOpened(true);
  }, []);

  const memoizedCtxValue = useMemo(
    () => ({
      opened,
      open,
      close
    }),
    [close, open, opened]
  );

  return <sortPopupContext.Provider value={memoizedCtxValue}>{children}</sortPopupContext.Provider>;
};

SortPopup.displayName = 'SortPopupContext';

export const useSortPopup = () => {
  const ctx = useContext(sortPopupContext);

  if (!ctx) {
    throw new Error('useSortPopup must be used within sortPopupContext');
  }

  return ctx;
};

// Popup content
export const SortPopupContent: FC<SortPopupContentProps> = ({
  items,
  on,
  toggle,
  alternativeLogic = false,
  title = <T id="sortBy" />
}) => {
  const { popup } = useAppEnv();
  const [selectedItem, setSelectedItem] = useState(() => items.find(i => i.selected) ?? items[0]);
  const [internalToggleValue, setInternalToggleValue] = useState(on);
  const { opened, close } = useSortPopup();

  const handleButtonClick = useCallback(() => {
    selectedItem.onClick?.();
    if (internalToggleValue !== on) toggle?.();
    close();
  }, [selectedItem, internalToggleValue, on, toggle, close]);

  const handleOptionSelect = useCallback((item: SortListItemType) => {
    setSelectedItem(item);
  }, []);

  const handleInternalToggle = useCallback(() => {
    setInternalToggleValue(!internalToggleValue);
  }, [internalToggleValue]);

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={title}
      portalClassName="sort-popup"
    >
      <div className="flex flex-col mt-2">
        <ul className={classNames('flex flex-col', popup ? 'px-4' : 'px-12')}>
          {items.map(item => (
            <SortListItem
              key={item.id}
              item={item}
              handleOptionSelect={handleOptionSelect}
              alternativeLogic={alternativeLogic}
              selectedItemId={selectedItem.id}
            />
          ))}
        </ul>
      </div>
      {on !== undefined && (
        <div className={classNames(popup ? 'px-4' : 'px-12')}>
          <SortDivider />
          <div className="flex justify-between items-center">
            <span className="text-sm tracking-normal text-white">
              <T id="hideZeroBalances" />
            </span>
            <Switcher on={on} onClick={alternativeLogic ? handleInternalToggle : toggle} />
          </div>
        </div>
      )}

      {alternativeLogic && (
        <div className={classNames('mt-8', popup ? 'px-4' : 'px-12')}>
          <ButtonRounded size="big" fill onClick={handleButtonClick} className={classNames('w-full')}>
            <T id="apply" />
          </ButtonRounded>
        </div>
      )}
    </PopupModalWithTitle>
  );
};

type SortListItemProps = {
  item: SortListItemType;
  handleOptionSelect: (item: SortListItemType) => void;
  alternativeLogic: boolean;
  selectedItemId: string;
};
const SortListItem: FC<SortListItemProps> = ({ item, alternativeLogic, handleOptionSelect, selectedItemId }) => {
  const { nameI18nKey, selected, disabled = false, onClick, id } = item;

  const checked = useMemo(
    () => (alternativeLogic ? id === selectedItemId : selected),
    [alternativeLogic, id, selected, selectedItemId]
  );

  const handleRadioClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className="flex items-center justify-between py-3 cursor-pointer"
      onClick={alternativeLogic ? () => handleOptionSelect(item) : onClick}
    >
      <div className="flex items-center">
        <span className="text-base-plus text-white">
          <T id={nameI18nKey} />
        </span>
      </div>
      <RadioButton id={id} checked={checked} disabled={disabled} onClick={handleRadioClick} />
    </div>
  );
};

// Sort button
export const SortButton: FC<{ className?: string }> = ({ className }) => {
  const { open } = useSortPopup();

  return (
    <div className={classNames('p-1 cursor-pointer', className)} onClick={open}>
      <SortIcon className="w-6 h-auto" />
    </div>
  );
};

const SortDivider = () => {
  return <div className="w-full h-0 border-b border-divider mt-4 mb-6" />;
};
